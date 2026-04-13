const googleAdsIntegration = require('../integrations/googleAds.integration');
const ConversionLog        = require('../models/conversionLog.model');
const { formatForGoogleAds } = require('../utils/dateFormatter');
const logger               = require('../utils/logger');

class GoogleAdsService {

    /**
     * Process a conversion for a lead that has a gclid.
     * Finds the correct conversion action by matching the pipeline stage keyword.
     */
    async processConversion(lead, agency, conversionValue = 0, options = {}) {
        const { currencyCode = 'USD', conversionTime: overrideTime = null, forcedActionId = null } = options;

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

        const { mapping: overrideMapping = null } = options;

        // Use forcedActionId if provided (can be full resource name or just ID)
        if (forcedActionId) {
            conversionActionId = forcedActionId.includes('conversionActions/') 
                ? forcedActionId.split('conversionActions/')[1] 
                : forcedActionId;
            conversionActionName = 'Manual/Forced Action';
        } 
        else if (overrideMapping) {
            conversionActionId   = overrideMapping.conversionActionId;
            conversionActionName = overrideMapping.conversionActionName;
            // Use mapping value if no value was passed
            if (!conversionValue && overrideMapping.conversionValue) {
                conversionValue = overrideMapping.conversionValue;
            }
        }
        else if (agency.conversionMappings && agency.conversionMappings.length > 0) {
            const stage   = (lead.pipelineStage || '').toLowerCase();
            const mapping = agency.conversionMappings.find(m =>
                stage.includes((m.pipelineStageKeyword || '').toLowerCase())
            );
            if (mapping) {
                conversionActionId   = mapping.conversionActionId;
                conversionActionName = mapping.conversionActionName;
                if (!conversionValue && mapping.conversionValue) {
                    conversionValue = mapping.conversionValue;
                }
            }
        }

        const conversionTime = overrideTime || formatForGoogleAds(new Date());

        // ── Save a log entry ──────────────────────────────────────
        const logRecord = new ConversionLog({
            agencyId:        agency._id,
            leadId:          lead._id,
            gclid:           lead.gclid,
            conversionTime,
            conversionValue: conversionValue > 0 ? conversionValue : (lead.conversionValue || 1),
            conversionAction: conversionActionId || 'none',
            status:          'pending'
        });

        if (!conversionActionId) {
            const reason = `No conversion mapping found for stage: "${lead.pipelineStage || 'unknown'}"`;
            logRecord.status = 'failed';
            logRecord.errorMessage = reason;
            await logRecord.save();
            
            logger.warn(`[GoogleAds] ${reason}. Skipping.`);
            return { success: false, reason };
        }

        await logRecord.save();

        const conversionData = {
            gclid:              lead.gclid,
            conversion_action:  `customers/${customerId}/conversionActions/${conversionActionId}`,
            conversion_date_time: conversionTime,
            conversion_value:   logRecord.conversionValue,
            currency_code:      currencyCode
        };

        // ── Upload to Google Ads ──────────────────────────────────────────
        try {
            const response = await googleAdsIntegration.uploadOfflineConversion({
                customerId,
                mccId:        agency.googleMccId,
                refreshToken: agency.googleRefreshToken,
                conversionData,
                credentials: {
                    clientId:       agency.customGoogleAdsClientId,
                    clientSecret:   agency.customGoogleAdsClientSecret,
                    developerToken: agency.customGoogleAdsDeveloperToken
                }
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
