const Lead           = require('../models/lead.model');
const Agency         = require('../models/agency.model');
const googleAdsService = require('./googleAds.service');
const logger         = require('../utils/logger');

class WebhookService {

    /**
     * Handle an incoming GHL webhook payload.
     * Supports multiple GCLID field locations GHL may use.
     */
    async handleGHLWebhook(payload) {
        logger.info('[Webhook] Received GHL payload');

        const {
            contact_id,
            location_id,
            email,
            phone,
            first_name,
            last_name,
            tags,
            customData,
            customFields,       // GHL often sends custom fields here
            contact,            // Some GHL versions wrap data under "contact"
            workflow,
            pipeline_stage,
            opportunity
        } = payload;

        const contactId  = contact_id  || contact?.id;
        const locationId = location_id || contact?.locationId;

        if (!contactId) {
            throw new Error('Payload missing contact_id');
        }
        if (!locationId) {
            throw new Error('Payload missing location_id — cannot route to agency');
        }

        // ── 1. Extract GCLID from wherever GHL puts it ───────────────────
        // GHL may send it as: customData.gclid, customFields array, or direct field
        let gclid = null;

        // Direct field
        if (payload.gclid)            gclid = payload.gclid;
        // customData object
        if (!gclid && customData?.gclid) gclid = customData.gclid;
        // customFields array (GHL format: [{id: "...", value: "..."}])
        if (!gclid && Array.isArray(customFields)) {
            const gclidField = customFields.find(f =>
                (f.name || '').toLowerCase().includes('gclid') ||
                (f.id   || '').toLowerCase().includes('gclid')
            );
            if (gclidField) gclid = gclidField.value;
        }
        // contact.customFields
        if (!gclid && Array.isArray(contact?.customFields)) {
            const gclidField = contact.customFields.find(f =>
                (f.name || '').toLowerCase().includes('gclid') ||
                (f.id   || '').toLowerCase().includes('gclid')
            );
            if (gclidField) gclid = gclidField.value;
        }

        // ── 2. Determine pipeline stage for conversion mapping ────────────
        const pipelineStage = pipeline_stage
            || opportunity?.pipeline_stage_name
            || workflow?.name
            || 'New Lead';

        // Determine if this event represents a conversion
        const tagList           = Array.isArray(tags) ? tags : [];
        const isConvertedStage  = tagList.some(t => t.toLowerCase().includes('purchased'))
            || (pipelineStage || '').toLowerCase().includes('purchased')
            || (pipelineStage || '').toLowerCase().includes('closed won')
            || (pipelineStage || '').toLowerCase().includes('won');
        const conversionValue   = payload.value || opportunity?.monetary_value || 0;

        // ── 3. Find the agency by locationId ─────────────────────────────
        const agency = await Agency.findOne({ locationId });
        if (!agency) {
            logger.error(`[Webhook] No agency for location: ${locationId}`);
            throw new Error(`Unknown location: ${locationId}. Install the app first.`);
        }

        // Warn loudly if Google isn't connected yet
        if (!agency.googleRefreshToken) {
            logger.warn(`[Webhook] Agency ${agency._id} has no Google Refresh Token — conversion will be skipped`);
        }
        if (!agency.googleAdsCustomerId) {
            logger.warn(`[Webhook] Agency ${agency._id} has no Google Ads Customer ID — conversion will be skipped`);
        }

        // ── 4. Upsert the Lead record ─────────────────────────────────────
        const lead = await Lead.findOneAndUpdate(
            { ghlContactId: contactId },
            {
                name:           `${first_name || ''} ${last_name || ''}`.trim(),
                email:          email,
                phone:          phone,
                agencyId:       agency._id,
                locationId,
                pipelineStage,
                conversionValue,
                isConverted:    isConvertedStage,
                ...(gclid ? { gclid } : {})
            },
            { upsert: true, new: true }
        );

        logger.info(`[Webhook] Lead upserted: ${lead._id} | stage: "${pipelineStage}" | gclid: ${gclid || 'none'} | converted: ${isConvertedStage}`);

        // ── 5. Upload conversion if conditions are met ────────────────────
        if (isConvertedStage && lead.gclid) {
            logger.info(`[Webhook] Triggering conversion upload for lead ${lead._id}`);
            await googleAdsService.processConversion(lead, agency, conversionValue);
        }

        return { success: true, leadId: lead._id, gclid: lead.gclid };
    }
}

module.exports = new WebhookService();
