const Agency = require('../models/agency.model');
const User = require('../models/User'); // Required for mapping
const ghlIntegration = require('../integrations/ghl.integration');
const logger = require('../utils/logger');
const crypto = require('crypto');

class GHLAuthService {
    async handleCallback(code, sessionUser = null) {
        try {
            // 1. Exchange code for token
            const tokenData = await ghlIntegration.getAccessToken(code);
            const { access_token, refresh_token, expires_in, locationId, companyId, userId, userType } = tokenData;

            const expiryDate = new Date();
            expiryDate.setSeconds(expiryDate.getSeconds() + expires_in);

            // 2. Fetch sub-account name
            let subAccountName = 'Unknown Sub-account';
            try {
                if (locationId) {
                    const locationData = await ghlIntegration.getLocationData(locationId, access_token);
                    subAccountName = locationData.location?.name || subAccountName;
                }
            } catch (e) {
                logger.warn(`Could not fetch sub-account name for LocationId: ${locationId}`);
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
                    subAccountName: subAccountName,
                    agencyName: subAccountName, // Legacy fallback
                    isActive: true
                },
                { upsert: true, new: true }
            );

            // 4. Update User Mapping - Link this sub-account to the user
            if (locationId) {
                let userEmail = sessionUser ? sessionUser.email : null;

                // Only fetch from GHL if we don't have a session user
                if (!userEmail && userId) {
                    userEmail = `ghl_${userId}@example.com`; // Fallback email
                    try {
                        const ghlUser = await ghlIntegration.getUserData(userId, companyId, access_token);
                        if (ghlUser && ghlUser.user && ghlUser.user.email) {
                            userEmail = ghlUser.user.email;
                        }
                    } catch (err) {
                        logger.warn(`Could not fetch user details for userId: ${userId}. Using fallback mapping.`);
                    }
                }

                if (userEmail) {
                    const existingUser = await User.findOne({ email: userEmail });
                    const updateDoc = { 
                        $addToSet: { locationIds: locationId },
                        ghlUserId: userId,
                        agencyId: companyId,
                        role: existingUser ? existingUser.role : 'user'
                    };

                    if (!existingUser) {
                        updateDoc.password = crypto.randomBytes(16).toString('hex');
                    }

                    await User.findOneAndUpdate(
                        { email: userEmail },
                        updateDoc,
                        { upsert: true, new: true }
                    );
                    logger.info(`[GHL Mapping] Mapped user ${userEmail} to location ${locationId}`);
                }
            }

            return agency;
        } catch (error) {
            logger.error('Error handling GHL Auth Callback:', error);
            throw error;
        }
    }
}

module.exports = new GHLAuthService();
