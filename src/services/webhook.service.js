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
        const locationId = overrideLocationId || payload.location_id || payload.contact?.locationId || payload.location?.id || customData?.['location id'];
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
        let forceMapping   = false;

        if (eventType && eventType !== 'general') {
            const webhookConfig = (agency.customWebhooks || []).find(w => w.slug === eventType);
            if (webhookConfig && webhookConfig.mappingId) {
                const linkedMapping = activeMappings.find(m => m._id && m._id.toString() === webhookConfig.mappingId.toString());
                if (linkedMapping) {
                    logger.info(`[Webhook] Explicitly linked to mapping: ${linkedMapping.pipelineStageKeyword}`);
                    activeMappings = [linkedMapping];
                    forceMapping   = true;
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
        if (!gclid && payload.Gclid) gclid = payload.Gclid;
        if (!gclid && customData?.gclid) gclid = customData.gclid;
        if (!gclid && customData?.['gclid']) gclid = customData['gclid'];
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
        let tagList = [];
        if (Array.isArray(tags)) {
            tagList = [...tags];
        } else if (typeof tags === 'string' && tags.trim() !== '') {
            tagList = tags.split(',').map(t => t.trim());
        }

        // Also check customData for tags (sometimes GHL puts them there)
        if (customData?.tags) {
            const extraTags = typeof customData.tags === 'string' 
                ? customData.tags.split(',').map(t => t.trim()) 
                : (Array.isArray(customData.tags) ? customData.tags : []);
            
            extraTags.forEach(t => {
                if (t && !tagList.includes(t)) tagList.push(t);
            });
        }
        
        let isConvertedStage = false;
        let matchedMapping   = null;

        if (activeMappings.length > 0) {
            if (forceMapping && activeMappings.length === 1) {
                // If explicitly linked to this webhook, just use it
                matchedMapping = activeMappings[0];
            } else {
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

                // FALLBACK: If there is ONLY ONE mapping in the entire agency, use it as a last resort
                if (!matchedMapping && agency.conversionMappings.length === 1) {
                    matchedMapping = agency.conversionMappings[0];
                }
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

        const conversionValue = payload.value || payload.Amount || opportunity?.monetary_value || payload.conversionValue || customData?.value || 0;
        const currencyCode    = payload.currencyCode || payload.currency_code || customData?.['currency code'] || 'USD';
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
                conversionTime,
                mapping: matchedMapping
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
