const schedule = require('node-schedule');
const Agency = require('../models/agency.model');
const ghlIntegration = require('../integrations/ghl.integration');
const googleAdsAuthService = require('./googleAdsAuth.service');
const logger = require('../utils/logger');

class TokenRefreshService {
    start() {
        // Run every hour to check for expiring tokens
        schedule.scheduleJob('0 * * * *', async () => {
            logger.info('[TokenRefresh] Starting automated token refresh check');
            await this.refreshAllExpiringTokens();
        });
        logger.info('[TokenRefresh] Automated token refresh scheduler started (runs hourly)');
    }

    async refreshAllExpiringTokens() {
        try {
            // Find all active agencies
            const agencies = await Agency.find({ isActive: true });
            const now = new Date();
            // Refresh threshold: if a token expires in less than 2 hours
            const threshold = new Date(now.getTime() + 2 * 60 * 60 * 1000);

            for (const agency of agencies) {
                // ── 1. Refresh GHL Token if expiring ──
                if (agency.ghlRefreshToken && (!agency.ghlTokenExpiry || agency.ghlTokenExpiry <= threshold)) {
                    try {
                        logger.info(`[TokenRefresh] Refreshing GHL token for agency ${agency.agencyId}`);
                        const tokens = await ghlIntegration.refreshAccessToken(agency.ghlRefreshToken);
                        const expiry = new Date(Date.now() + (tokens.expires_in * 1000));
                        
                        agency.ghlAccessToken = tokens.access_token;
                        agency.ghlRefreshToken = tokens.refresh_token; 
                        agency.ghlTokenExpiry = expiry;
                        await agency.save();
                        logger.info(`[TokenRefresh] Success: GHL token refreshed for agency ${agency.agencyId}`);
                    } catch (error) {
                        logger.error(`[TokenRefresh] Failed to refresh GHL token for agency ${agency.agencyId}: ${error.message}`);
                    }
                }

                // ── 2. Refresh Google Ads Token if expiring ──
                if (agency.googleRefreshToken && (!agency.googleTokenExpiry || agency.googleTokenExpiry <= threshold)) {
                    try {
                        logger.info(`[TokenRefresh] Refreshing Google token for agency ${agency.agencyId}`);
                        const accessToken = await googleAdsAuthService.refreshAccessToken(agency);
                        // refreshAccessToken already saves the agency model internally
                        logger.info(`[TokenRefresh] Success: Google Ads token refreshed for agency ${agency.agencyId}`);
                    } catch (error) {
                        logger.error(`[TokenRefresh] Failed to refresh Google Ads token for agency ${agency.agencyId}: ${error.message}`);
                    }
                }
            }
        } catch (error) {
            logger.error(`[TokenRefresh] Error during automated token refresh: ${error.message}`);
        }
    }
}

module.exports = new TokenRefreshService();
