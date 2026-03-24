const { google } = require('googleapis');
const dotenv = require('dotenv');
dotenv.config();

class GoogleAdsAuthService {
    constructor() {
        this.oauth2Client = new google.auth.OAuth2(
            process.env.GOOGLE_ADS_CLIENT_ID,
            process.env.GOOGLE_ADS_CLIENT_SECRET,
            process.env.GOOGLE_ADS_REDIRECT_URI
        );

        // Google Ads API Scope
        this.SCOPES = ['https://www.googleapis.com/auth/adwords'];
    }

    getAuthUrl(state) {
        return this.oauth2Client.generateAuthUrl({
            access_type: 'offline', // crucial for refresh tokens
            prompt: 'consent', // Force consent to get refresh token every time
            scope: this.SCOPES,
            state: state // Use this to pass locationId/agencyId back
        });
    }


    async getTokens(code) {
        const { tokens } = await this.oauth2Client.getToken(code);
        return tokens;
    }
}

module.exports = new GoogleAdsAuthService();
