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

            // 2. Fetch specific details if needed
            let agencyName = 'Unknown Agency';
            if (locationId) {
                try {
                    // If we got a location level install, we might want to get location name
                    const locationData = await ghlIntegration.getLocationData(locationId, access_token);
                    agencyName = locationData.location?.name || agencyName;
                } catch (e) {
                    logger.warn(`Could not fetch location data right away for: ${locationId}`);
                }
            }

            // 3. Save or update agency in our Database
            const agency = await Agency.findOneAndUpdate(
                { locationId: locationId }, // Unique per sub-account (location)
                {
                    agencyId: companyId || locationId,
                    locationId: locationId || null,
                    ghlAccessToken: access_token,
                    ghlRefreshToken: refresh_token,
                    ghlTokenExpiry: expiryDate,
                    agencyName: agencyName,
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
