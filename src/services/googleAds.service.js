const googleAdsIntegration = require('../integrations/googleAds.integration');
const ConversionLog = require('../models/conversionLog.model');
const { formatForGoogleAds } = require('../utils/dateFormatter');
const logger = require('../utils/logger');

class GoogleAdsService {
    async processConversion(lead, campaign, agency, conversionValue = 0) {
        if (!lead.gclid) {
            logger.info(`Lead ${lead.ghlContactId} has no GCLID. Skipping offline conversion upload.`);
            return { success: false, reason: 'No GCLID' };
        }

        const customerId = agency.googleAdsCustomerId?.toString().replace(/-/g, ''); // Remove dashes
        if (!customerId || !/^\d{10}$/.test(customerId)) {
            logger.error(`Agency ${agency._id} has an invalid Google Ads Customer ID: ${agency.googleAdsCustomerId}. It must be a 10-digit number.`);
            return { success: false, reason: 'Invalid Customer ID' };
        }

        const conversionActionId = campaign.googleAdsConversionActionId;
        if (!conversionActionId) {
            logger.error(`Campaign ${campaign._id} doesn't have a mapped Conversion Action ID.`);
            return { success: false, reason: 'No Conversion Action ID mapped' };
        }

        const conversionTime = formatForGoogleAds(new Date());

        const conversionData = {
            gclid: lead.gclid,
            conversion_action: `customers/${customerId}/conversionActions/${conversionActionId}`,
            conversion_date_time: conversionTime,
            conversion_value: conversionValue > 0 ? conversionValue : lead.conversionValue || 1,
            currency_code: 'USD'
        };

        const logRecord = new ConversionLog({
            leadId: lead._id,
            gclid: lead.gclid,
            conversionTime,
            conversionValue: conversionData.conversionValue,
            conversionAction: conversionActionId,
            status: 'pending'
        });

        if (!agency.googleRefreshToken) {
            logger.error(`Agency ${agency._id} has no Google Refresh Token. Skipping conversion.`);
            return { success: false, reason: 'No Refresh Token' };
        }

        try {
            const response = await googleAdsIntegration.uploadOfflineConversion({
                customerId,
                refreshToken: agency.googleRefreshToken, // Pass the dynamic token
                conversionData
            });


            logRecord.status = 'success';
            logRecord.googleAdsResponse = response;
            await logRecord.save();

            return { success: true, response };
        } catch (error) {
            logRecord.status = 'failed';
            logRecord.errorMessage = error.message;
            await logRecord.save();
            throw error;
        }
    }
}

module.exports = new GoogleAdsService();
