const Agency = require('../models/agency.model');
const ghlIntegration = require('../integrations/ghl.integration');
const logger = require('../utils/logger');

class GHLAuthService {
    async handleCallback(code) {
        try {
            // 1. Exchange code for token
            const tokenData = await ghlIntegration.getAccessToken(code);
            const { access_token, refresh_token, expires_in, locationId, companyId } = tokenData;

            const expiryDate = new Date();
            expiryDate.setSeconds(expiryDate.getSeconds() + expires_in);

            // 2. Fetch specific details
            let companyName = 'Unknown Agency';
            let subAccountName = 'Unknown Sub-account';

            try {
                if (companyId) {
                    const companyData = await ghlIntegration.getCompanyData(companyId, access_token);
                    companyName = companyData.company?.name || companyName;
                }
                if (locationId) {
                    const locationData = await ghlIntegration.getLocationData(locationId, access_token);
                    subAccountName = locationData.location?.name || subAccountName;
                }
            } catch (e) {
                logger.warn(`Could not fetch full names for Company: ${companyId}, Location: ${locationId}`);
            }

            // 3. Save or update agency in our Database
            const agency = await Agency.findOneAndUpdate(
                { locationId: locationId }, // Unique per sub-account (location)
                {
                    agencyId: companyId,
                    locationId: locationId || null,
                    ghlAccessToken: access_token,
                    ghlRefreshToken: refresh_token,
                    ghlTokenExpiry: expiryDate,
                    companyName: companyName,
                    subAccountName: subAccountName,
                    agencyName: subAccountName, // Legacy fallback
                    isActive: true
                },
                { upsert: true, new: true }
            );

            return agency;
        } catch (error) {
            logger.error('Error handling GHL Auth Callback:', error);
            throw error;
        }
    }
}

module.exports = new GHLAuthService();
