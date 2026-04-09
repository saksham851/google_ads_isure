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
            redirect_uri: process.env.GHL_REDIRECT_URI || `${process.env.BASE_URL}/auth/callback`
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

    async getCompanyData(companyId, token) {
        const response = await axios.get(`${this.apiBaseUrl}/companies/${companyId}`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Version': '2021-07-28'
            }
        });
        return response.data;
    }

    async getUserData(userId, companyId, token) {
        const response = await axios.get(`${this.apiBaseUrl}/users/${userId}?companyId=${companyId}`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Version': '2021-07-28'
            }
        });
        return response.data;
    }

    async uninstallApp(locationId, token) {
        try {
            const response = await axios.delete(`${this.apiBaseUrl}/marketplace/app/${this.clientId}/installations`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Version': '2021-07-28',
                    'Content-Type': 'application/json'
                },
                data: {
                    locationId: locationId,
                    reason: 'User requested uninstall via app dashboard'
                }
            });
            return response.data;
        } catch (error) {
            // Log full error but don't crash if it already uninstalled or failed
            console.error('[GHL Integration] Uninstall API Error:', error.response?.data || error.message);
            return null;
        }
    }
}

module.exports = new GHLIntegration();
