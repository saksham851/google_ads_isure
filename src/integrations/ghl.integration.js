const axios = require('axios');
const dotenv = require('dotenv');
dotenv.config();
const qs = require('qs');

class GHLIntegration {
    constructor() {
        this.apiBaseUrl = 'https://services.leadconnectorhq.com';
        this.clientId = process.env.GHL_CLIENT_ID;
        this.clientSecret = process.env.GHL_CLIENT_SECRET;
    }

    async getAccessToken(code) {
        const data = qs.stringify({
            client_id: this.clientId,
            client_secret: this.clientSecret,
            grant_type: 'authorization_code',
            code: code,
            redirect_uri: process.env.GHL_REDIRECT_URI || 'http://localhost:3000/auth/callback'
        });

        const response = await axios.post(`${this.apiBaseUrl}/oauth/token`, data, {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Accept': 'application/json'
            }
        });

        return response.data; // { access_token, refresh_token, locationId, companyId, ... }
    }

    async refreshAccessToken(refreshToken) {
        const data = qs.stringify({
            client_id: this.clientId,
            client_secret: this.clientSecret,
            grant_type: 'refresh_token',
            refresh_token: refreshToken
        });

        const response = await axios.post(`${this.apiBaseUrl}/oauth/token`, data, {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Accept': 'application/json'
            }
        });

        return response.data;
    }

    async getLocationData(locationId, token) {
        const response = await axios.get(`${this.apiBaseUrl}/locations/${locationId}`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Version': '2021-07-28'
            }
        });
        return response.data;
    }
}

module.exports = new GHLIntegration();
