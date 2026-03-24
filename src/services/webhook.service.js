const Lead = require('../models/lead.model');
const Agency = require('../models/agency.model');
const Campaign = require('../models/campaign.model');
const googleAdsService = require('./googleAds.service');
const logger = require('../utils/logger');

class WebhookService {
    async handleGHLWebhook(payload) {
        logger.info('Received GHL Webhook payload');

        const {
            contact_id, location_id, email, phone, first_name, last_name, tags, customData, workflow
        } = payload;

        if (!contact_id) {
            throw new Error("Payload missing contact_id");
        }

        // Attempt to parse out GCLID & UTMs (these could be custom fields mapped in GHL or tags, context dependent)
        // Assuming customData or specific payload structure carries tracking parameters.
        let gclid = customData?.gclid || null;
        let pipelineStage = workflow?.name || 'New Lead'; // Just for context, mapping depends on exactly how webhook is configured

        // Check if conversion happens - "Purchased" or specific tag/stage
        const isConvertedStage = (tags && tags.includes('Purchased')) || pipelineStage.toLowerCase().includes('purchased');
        const conversionValue = payload?.value || 0;

        // 1. Resolve Agency and Campaign
        logger.info(`Resolving Agency for Location: ${location_id}`);
        const agency = await Agency.findOne({ locationId: location_id });
        if (!agency) {
            logger.error(`Agency not found for location: ${location_id}`);
            throw new Error(`Unrecognized location: ${location_id}. Ensure App is installed correctly.`);
        }

        if (!agency.googleRefreshToken) {
            logger.error(`No Google Refresh Token found for agency: ${location_id}`);
        } else {
            logger.info(`Found Google Refresh Token for agency: ${location_id}`);
        }


        // To mock routing, we assume a default campaign for this demo if an exact matching mechanism is absent
        const campaign = await Campaign.findOne({ agencyId: agency._id, status: 'active' });
        if (!campaign && isConvertedStage) {
            throw new Error(`No active campaigns set up for location ${location_id}. Can't route conversion.`);
        }

        // 2. Insert or update the Lead
        const lead = await Lead.findOneAndUpdate(
            { ghlContactId: contact_id },
            {
                name: `${first_name || ''} ${last_name || ''}`.trim(),
                email: email,
                phone: phone,
                agencyId: agency._id,
                locationId: location_id,
                $set: gclid ? { gclid } : {}, // Update GCLID if we received one
                pipelineStage,
                conversionValue: conversionValue,
                isConverted: isConvertedStage || false
            },
            { upsert: true, new: true }
        );

        // 3. Trigger Google Ads API if converted and has gclid
        if (isConvertedStage && lead.gclid) {
            logger.info(`Triggering Conversion Upload for Lead: ${lead._id}`);
            await googleAdsService.processConversion(lead, campaign, agency, conversionValue);
        }

        return { success: true, leadId: lead._id };
    }
}

module.exports = new WebhookService();
