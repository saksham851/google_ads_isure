const { google } = require('googleapis');
const Agency     = require('../models/agency.model');
const logger     = require('../utils/logger');
const dotenv     = require('dotenv');
dotenv.config();

class GoogleAdsAuthService {
    constructor() {
        this.SCOPES = ['https://www.googleapis.com/auth/adwords'];
    }

    /**
     * Helper to build a dynamic OAuth2 client based on agency or default env
     */
    _getOAuthClient(agency = null) {
        const clientId     = agency?.customGoogleAdsClientId     || process.env.GOOGLE_ADS_CLIENT_ID;
        const clientSecret = agency?.customGoogleAdsClientSecret || process.env.GOOGLE_ADS_CLIENT_SECRET;
        const redirectUri  = process.env.GOOGLE_ADS_REDIRECT_URI;

        return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
    }

    /**
     * Generate the Google OAuth URL.
     * We encode the locationId in the `state` param so the callback can find the agency.
     */
    async getAuthUrl(locationId) {
        const agency = await Agency.findOne({ locationId });
        const oauth2Client = this._getOAuthClient(agency);

        return oauth2Client.generateAuthUrl({
            access_type: 'offline',
            prompt:      'consent', // Force consent screen to always get a refresh_token
            scope:       this.SCOPES,
            state:       locationId // passed back verbatim by Google
        });
    }

    /**
     * Exchange the authorization code for tokens.
     */
    async getTokens(code, locationId) {
        const agency = await Agency.findOne({ locationId });
        const oauth2Client = this._getOAuthClient(agency);

        const { tokens } = await oauth2Client.getToken(code);
        return tokens;
    }

    /**
     * Refresh a Google access token using the stored refresh token.
     * Updates the agency record in the DB.
     */
    async refreshAccessToken(agency) {
        if (!agency.googleRefreshToken) {
            throw new Error(`No Google refresh token for agency ${agency._id}`);
        }

        const oauth2Client = this._getOAuthClient(agency);
        oauth2Client.setCredentials({ refresh_token: agency.googleRefreshToken });

        const { credentials } = await oauth2Client.refreshAccessToken();

        const expiry = credentials.expiry_date
            ? new Date(credentials.expiry_date)
            : new Date(Date.now() + 3600 * 1000);

        await Agency.findByIdAndUpdate(agency._id, {
            googleAccessToken: credentials.access_token,
            googleTokenExpiry: expiry
        });

        logger.info(`[GoogleAdsAuth] Refreshed access token for agency ${agency._id}`);
        return credentials.access_token;
    }

    /**
     * Get a valid access token for the agency — refreshes if expired or missing.
     */
    async getValidAccessToken(agency) {
        const now = new Date();
        // Refresh if within 5 minutes of expiry or missing
        const isExpired = !agency.googleTokenExpiry || agency.googleTokenExpiry <= new Date(now.getTime() + 5 * 60 * 1000);
        if (!agency.googleAccessToken || isExpired) {
            return this.refreshAccessToken(agency);
        }
        return agency.googleAccessToken;
    }
}

module.exports = new GoogleAdsAuthService();
