const Agency = require('../models/agency.model');
const User = require('../models/User'); // Required for mapping
const ghlIntegration = require('../integrations/ghl.integration');
const logger = require('../utils/logger');
const crypto = require('crypto');
const { sendEmail } = require('../utils/mail.util');

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
                    let user = await User.findOne({ email: userEmail });
                    let generatedPassword = null;
                    let isNewUser = false;

                    if (!user) {
                        isNewUser = true;
                        generatedPassword = crypto.randomBytes(6).toString('hex'); // 12 chars
                        user = new User({
                            email: userEmail,
                            password: generatedPassword, // Hook will hash this
                            ghlUserId: userId,
                            agencyId: companyId,
                            role: 'user',
                            locationIds: [locationId]
                        });
                    } else {
                        // User exists, just add the new location if not already there
                        if (!user.locationIds.includes(locationId)) {
                            user.locationIds.push(locationId);
                        }
                        user.ghlUserId = userId;
                        user.agencyId = companyId;
                    }

                    await user.save();
                    logger.info(`[GHL Mapping] Mapped user ${userEmail} to location ${locationId}`);

                    // 5. Send Email with credentials
                    try {
                        const dashboardUrl = `${process.env.BASE_URL || 'http://localhost:3000'}/user/login`;
                        let emailHtml = '';
                        
                        if (isNewUser) {
                            emailHtml = `
                                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #e0e0e0; padding: 20px; border-radius: 10px;">
                                    <h2 style="color: #1a73e8; text-align: center;">Welcome to Google Ads Tracking!</h2>
                                    <p>Hello,</p>
                                    <p>Your app has been successfully installed for the sub-account: <strong>${subAccountName}</strong>.</p>
                                    <p>Here are your login credentials to access your tracking dashboard:</p>
                                    <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
                                        <p style="margin: 5px 0;"><strong>Email:</strong> ${userEmail}</p>
                                        <p style="margin: 5px 0;"><strong>Password:</strong> ${generatedPassword}</p>
                                    </div>
                                    <p style="text-align: center;">
                                        <a href="${dashboardUrl}" style="background-color: #1a73e8; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold;">Login to Dashboard</a>
                                    </p>
                                    <p style="font-size: 12px; color: #777; margin-top: 30px;">If you didn't authorize this installation, please contact support.</p>
                                </div>
                            `;
                        } else {
                            emailHtml = `
                                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #e0e0e0; padding: 20px; border-radius: 10px;">
                                    <h2 style="color: #1a73e8; text-align: center;">New App Installation</h2>
                                    <p>Hello,</p>
                                    <p>The Google Ads Tracking app has been successfully installed for a new sub-account: <strong>${subAccountName}</strong>.</p>
                                    <p>This sub-account has been added to your existing account (${userEmail}). You can now manage its conversions from your dashboard.</p>
                                    <p style="text-align: center;">
                                        <a href="${dashboardUrl}" style="background-color: #1a73e8; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold;">Go to Dashboard</a>
                                    </p>
                                </div>
                            `;
                        }

                        await sendEmail({
                            to: userEmail,
                            subject: isNewUser ? 'Your Google Ads Tracking Credentials' : `App Installed for ${subAccountName}`,
                            html: emailHtml
                        });
                        logger.info(`[GHL Auth] Welcome email sent to ${userEmail}`);
                    } catch (mailErr) {
                        logger.error(`[GHL Auth] Failed to send welcome email to ${userEmail}:`, mailErr.message);
                    }
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
