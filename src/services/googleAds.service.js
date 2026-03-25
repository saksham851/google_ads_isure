const googleAdsIntegration = require('../integrations/googleAds.integration');
const ConversionLog        = require('../models/conversionLog.model');
const { formatForGoogleAds } = require('../utils/dateFormatter');
const logger               = require('../utils/logger');

class GoogleAdsService {

    /**
     * Process a conversion for a lead that has a gclid.
     * Finds the correct conversion action by matching the pipeline stage keyword.
     */
    async processConversion(lead, agency, conversionValue = 0) {
        if (!lead.gclid) {
            logger.info(`[GoogleAds] Lead ${lead.ghlContactId} has no GCLID. Skipping.`);
            return { success: false, reason: 'No GCLID' };
        }

        if (!agency.googleRefreshToken) {
            logger.error(`[GoogleAds] Agency ${agency._id} has no Google Refresh Token.`);
            return { success: false, reason: 'No Refresh Token' };
        }

        const customerId = agency.googleAdsCustomerId?.toString().replace(/-/g, '');
        if (!customerId) {
            logger.error(`[GoogleAds] Agency ${agency._id} has no Google Ads Customer ID set.`);
            return { success: false, reason: 'No Customer ID' };
        }

        // ── Find the matching conversion action ──────────────────────────
        let conversionActionId   = null;
        let conversionActionName = null;

        if (agency.conversionMappings && agency.conversionMappings.length > 0) {
            const stage   = (lead.pipelineStage || '').toLowerCase();
            const mapping = agency.conversionMappings.find(m =>
                stage.includes((m.pipelineStageKeyword || '').toLowerCase())
            );
            if (mapping) {
                conversionActionId   = mapping.conversionActionId;
                conversionActionName = mapping.conversionActionName;
                // Use mapping value if no value was passed
                if (!conversionValue && mapping.conversionValue) {
                    conversionValue = mapping.conversionValue;
                }
            }
        }

        if (!conversionActionId) {
            logger.warn(`[GoogleAds] No conversion action mapped for stage: "${lead.pipelineStage}". Skipping.`);
            return { success: false, reason: 'No Conversion Action mapped for this stage' };
        }

        const conversionTime = formatForGoogleAds(new Date());
        const conversionData = {
            gclid:              lead.gclid,
            conversion_action:  `customers/${customerId}/conversionActions/${conversionActionId}`,
            conversion_date_time: conversionTime,
            conversion_value:   conversionValue > 0 ? conversionValue : (lead.conversionValue || 1),
            currency_code:      'USD'
        };

        // ── Save a pending log entry ──────────────────────────────────────
        const logRecord = new ConversionLog({
            agencyId:        agency._id,
            leadId:          lead._id,
            gclid:           lead.gclid,
            conversionTime,
            conversionValue: conversionData.conversion_value,
            conversionAction: conversionActionId,
            status:          'pending'
        });
        await logRecord.save();

        // ── Upload to Google Ads ──────────────────────────────────────────
        try {
            const response = await googleAdsIntegration.uploadOfflineConversion({
                customerId,
                mccId:        agency.googleMccId,
                refreshToken: agency.googleRefreshToken,
                conversionData
            });

            logRecord.status            = 'success';
            logRecord.googleAdsResponse = response;
            await logRecord.save();

            logger.info(`[GoogleAds] Conversion uploaded for lead ${lead._id} (action: ${conversionActionName})`);
            return { success: true, response };
        } catch (error) {
            logRecord.status       = 'failed';
            logRecord.errorMessage = error.message;
            await logRecord.save();
            throw error;
        }
    }
}

module.exports = new GoogleAdsService();
