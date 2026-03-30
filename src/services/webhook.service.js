const Lead           = require('../models/lead.model');
const Agency         = require('../models/agency.model');
const googleAdsService = require('./googleAds.service');
const logger         = require('../utils/logger');

class WebhookService {

    /**
     * Handle an incoming GHL webhook payload.
     * Supports multiple GCLID field locations GHL may use.
     */
    async handleGHLWebhook(payload, overrideLocationId = null, eventType = 'general') {
        logger.info(`[Webhook] Received payload | event: ${eventType}`);

        // 1. Determine locationId first to find the agency
        const locationId = overrideLocationId || payload.location_id || payload.contact?.locationId;
        if (!locationId) {
            throw new Error('Payload missing location_id — cannot route to agency');
        }

        const agency = await Agency.findOne({ locationId });
        if (!agency) {
            logger.error(`[Webhook] No agency for location: ${locationId}`);
            throw new Error(`Unknown location: ${locationId}. Install the app first.`);
        }

        // 2. Filter mappings if this webhook is linked to a specific one
        let activeMappings = agency.conversionMappings || [];
        if (eventType && eventType !== 'general') {
            const webhookConfig = (agency.customWebhooks || []).find(w => w.slug === eventType);
            if (webhookConfig && webhookConfig.mappingId) {
                const linkedMapping = activeMappings.find(m => m._id && m._id.toString() === webhookConfig.mappingId.toString());
                if (linkedMapping) {
                    logger.info(`[Webhook] Restricting to linked mapping: ${linkedMapping.pipelineStageKeyword}`);
                    activeMappings = [linkedMapping];
                }
            }
        }

        // 3. Multi-Conversion Support (if payload matches the user's provided curl format)
        if (Array.isArray(payload.conversions)) {
            logger.info(`[Webhook] Processing ${payload.conversions.length} conversions from array payload`);
            const results = [];
            for (const conv of payload.conversions) {
                try {
                    const result = await this._processSingleManualConversion(conv, agency);
                    results.push(result);
                } catch (e) {
                    logger.error(`[Webhook] Manual conversion failed: ${e.message}`);
                    results.push({ success: false, error: e.message });
                }
            }
            return { success: true, processed: results };
        }

        // 4. Standard GHL Flat Payload handling
        const {
            contact_id,
            email,
            phone,
            first_name,
            last_name,
            tags,
            customData,
            customFields,
            contact,
            workflow,
            pipeline_stage,
            opportunity
        } = payload;

        const contactId  = contact_id  || contact?.id || `manual-${Date.now()}`;

        // Extract GCLID
        let gclid = null;
        if (payload.gclid) gclid = payload.gclid;
        if (!gclid && customData?.gclid) gclid = customData.gclid;
        if (!gclid && Array.isArray(customFields)) {
            const gclidField = customFields.find(f =>
                (f.name || '').toLowerCase().includes('gclid') ||
                (f.id   || '').toLowerCase().includes('gclid')
            );
            if (gclidField) gclid = gclidField.value;
        }
        if (!gclid && Array.isArray(contact?.customFields)) {
            const gclidField = contact.customFields.find(f =>
                (f.name || '').toLowerCase().includes('gclid') ||
                (f.id   || '').toLowerCase().includes('gclid')
            );
            if (gclidField) gclid = gclidField.value;
        }

        // Determine pipeline stage
        const pipelineStage = pipeline_stage
            || opportunity?.pipeline_stage_name
            || workflow?.name
            || payload.stage
            || 'New Lead';

        // Determine if this event represents a conversion according to Agency Mappings
        const tagList = Array.isArray(tags) ? tags : [];
        let isConvertedStage = false;
        let matchedMapping   = null;

        if (activeMappings.length > 0) {
            // Check if pipelineStage keyword matches
            const stageLower = (pipelineStage || '').toLowerCase();
            matchedMapping = activeMappings.find(m =>
                stageLower.includes((m.pipelineStageKeyword || '').toLowerCase())
            );

            // Also check tags if pipelineStage didn't match
            if (!matchedMapping && tagList.length > 0) {
                matchedMapping = activeMappings.find(m =>
                    tagList.some(tag => tag.toLowerCase().includes((m.pipelineStageKeyword || '').toLowerCase()))
                );
            }

            if (matchedMapping) {
                isConvertedStage = true;
            }
        }

        // Fallback to defaults if no mappings (for backward compatibility or safety)
        if (!isConvertedStage) {
            isConvertedStage = tagList.some(t => t.toLowerCase().includes('purchased'))
                || (pipelineStage || '').toLowerCase().includes('purchased')
                || (pipelineStage || '').toLowerCase().includes('closed won')
                || (pipelineStage || '').toLowerCase().includes('won');
        }

        const conversionValue = payload.value || opportunity?.monetary_value || payload.conversionValue || 0;
        const currencyCode    = payload.currencyCode || payload.currency_code || 'USD';
        const conversionTime  = payload.conversionDateTime || payload.conversion_date_time || null;

        // 4. Upsert Lead record
        const lead = await Lead.findOneAndUpdate(
            { ghlContactId: contactId },
            {
                name:           `${first_name || ''} ${last_name || ''}`.trim(),
                email:          email,
                phone:          phone,
                agencyId:       agency._id,
                locationId,
                pipelineStage:  pipelineStage,
                conversionValue,
                isConverted:    isConvertedStage,
                ...(gclid ? { gclid } : {})
            },
            { upsert: true, new: true }
        );

        logger.info(`[Webhook] Lead upserted: ${lead._id} | stage: "${pipelineStage}" | gclid: ${gclid || 'none'} | converted: ${isConvertedStage}`);

        // 5. Upload conversion if conditions are met
        if (isConvertedStage && lead.gclid) {
            logger.info(`[Webhook] Triggering conversion upload for lead ${lead._id}`);
            await googleAdsService.processConversion(lead, agency, conversionValue, {
                currencyCode,
                conversionTime
            });
        }

        return { success: true, leadId: lead._id, gclid: lead.gclid };
    }

    /**
     * Helper to process a conversion from a manual JSON payload (like the user requested)
     */
    async _processSingleManualConversion(conv, agency) {
        const { 
            gclid, 
            pipeline_stage, 
            stage, 
            conversion_action, 
            conversionValue, 
            value, 
            currencyCode, 
            conversionDateTime,
            email,
            phone,
            name
        } = conv;

        if (!gclid) throw new Error('Missing gclid in conversion');

        const pipelineStage = pipeline_stage || stage || 'Manual Upload';
        const contactId     = `manual-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

        // Upsert a lead record so the conversion is tracked in our DB
        const lead = await Lead.findOneAndUpdate(
            { ghlContactId: contactId },
            {
                name:           name || 'Manual Lead',
                email:          email || '',
                phone:          phone || '',
                agencyId:       agency._id,
                locationId:     agency.locationId,
                pipelineStage:  pipelineStage,
                conversionValue: conversionValue || value || 0,
                isConverted:    true, // Assume it's a conversion since they're manually sending it
                gclid
            },
            { upsert: true, new: true }
        );

        return await googleAdsService.processConversion(lead, agency, conversionValue || value || 0, {
            currencyCode: currencyCode || 'USD',
            conversionTime: conversionDateTime || null,
            forcedActionId: conversion_action // If they send customers/.../conversionActions/123
        });
    }
}

module.exports = new WebhookService();
