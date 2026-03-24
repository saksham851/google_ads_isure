const { GoogleAdsApi } = require('google-ads-api');
const dotenv = require('dotenv');
dotenv.config();
const logger = require('../utils/logger');

class GoogleAdsIntegration {
    constructor() {
        this.client = new GoogleAdsApi({
            client_id: process.env.GOOGLE_ADS_CLIENT_ID,
            client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET,
            developer_token: process.env.GOOGLE_ADS_DEVELOPER_TOKEN
        });
        this.managerId = (process.env.GOOGLE_ADS_MANAGER_ACCOUNT_ID || '').replace(/-/g, '');
    }

    /**
     * Uploads offline conversions to Google Ads using the official library.
     * @param {Object} params 
     * @param {string} params.customerId - The 10-digit customer ID (without dashes).
     * @param {string} params.refreshToken - The refresh token for the specific agency/account.
     * @param {Object} params.conversionData - The conversion data object.
     */
    async uploadOfflineConversion({ customerId, refreshToken, conversionData }) {
        try {
            logger.info(`Uploading conversion to Google Ads for Customer: ${customerId}`);

            const customer = this.client.Customer({
                customer_id: customerId,
                refresh_token: refreshToken,
                login_customer_id: this.managerId
            });

            // The library handles token refreshing and endpoint construction automatically.
            // NOTE: Service calls (unlike mutations) do NOT auto-inject customer_id — must be explicit.
            const response = await customer.conversionUploads.uploadClickConversions({
                customer_id: customerId,
                conversions: [conversionData],
                partial_failure: true,
                validate_only: false
            });

            logger.info(`Google Ads Conversion Upload Success for Customer ${customerId}`);
            return response;
        } catch (err) {
            const errorDetail = err.message || JSON.stringify(err);
            logger.error(`Failed to upload offline conversion to Google Ads: ${errorDetail}`);
            throw err;
        }
    }
}

module.exports = new GoogleAdsIntegration();
