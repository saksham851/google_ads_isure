const { GoogleAdsApi } = require('google-ads-api');
const dotenv = require('dotenv');
dotenv.config();
const logger = require('../utils/logger');

class GoogleAdsIntegration {
    /**
     * Build a GoogleAdsApi client authenticated with a specific refresh token.
     */
    _buildClient(credentials = {}) {
        return new GoogleAdsApi({
            client_id:       credentials.clientId       || process.env.GOOGLE_ADS_CLIENT_ID,
            client_secret:   credentials.clientSecret   || process.env.GOOGLE_ADS_CLIENT_SECRET,
            developer_token: credentials.developerToken || process.env.GOOGLE_ADS_DEVELOPER_TOKEN
        });
    }

    /**
     * List all Manager (MCC) accounts accessible by this refresh token.
     * Returns an array of { id, name, currencyCode, timeZone }
     */
    async listManagerAccounts(refreshToken, credentials = {}) {
        const client = this._buildClient(credentials);
        // Use an "accessible customers" query — no login_customer_id needed
        const customer = client.Customer({
            customer_id: 'NONE', // placeholder, overridden by accessible customers call
            refresh_token: refreshToken
        });

        try {
            // accessible_customers returns root-level accounts the token can access
            const accessible = await client.listAccessibleCustomers(refreshToken);
            // Each entry is a resource name like "customers/1234567890"
            const ids = (accessible.resource_names || []).map(r => r.replace('customers/', ''));

            // For each, try to fetch basic info
            const results = [];
            for (const id of ids) {
                try {
                    const cust = client.Customer({ customer_id: id, refresh_token: refreshToken });
                    const rows = await cust.query(`
                        SELECT customer.id, customer.descriptive_name, customer.manager,
                               customer.currency_code, customer.time_zone
                        FROM customer
                        LIMIT 1
                    `);
                    if (rows.length > 0) {
                        const c = rows[0].customer;
                        results.push({
                            id: String(c.id),
                            name: c.descriptive_name || `Account ${c.id}`,
                            isManager: c.manager,
                            currencyCode: c.currency_code,
                            timeZone: c.time_zone
                        });
                    }
                } catch (e) {
                    // Include it anyway with a fallback name!
                    const errorMsg = e.errors ? (Array.isArray(e.errors) ? e.errors[0]?.message : JSON.stringify(e.errors)) : (e.message || "Unknown API Error");
                    logger.warn(`[GoogleAds] Could not query account ${id}: ${errorMsg}`);
                    results.push({
                        id:           String(id),
                        name:         `Account: ${id} (${errorMsg.substring(0, 20)}...)`,
                        isManager:    true,
                        currencyCode: 'USD',
                        timeZone:     'America/New_York'
                    });
                }
            }

            // Return managers first, then clients
            return results.sort((a, b) => (b.isManager ? 1 : 0) - (a.isManager ? 1 : 0));
        } catch (err) {
            logger.error(`[GoogleAds] listManagerAccounts failed: ${err.message}`);
            throw err;
        }
    }

    /**
     * List all client (sub) accounts under a given Manager (MCC) account.
     * Returns an array of { id, name, currencyCode }
     */
    async listClientAccounts(mccId, refreshToken, credentials = {}) {
        const client = this._buildClient(credentials);
        const mccClean = String(mccId).replace(/-/g, '');
        const manager = client.Customer({
            customer_id: mccClean,
            login_customer_id: mccClean,
            refresh_token: refreshToken
        });

        try {
            const rows = await manager.query(`
                SELECT customer_client.id,
                       customer_client.descriptive_name,
                       customer_client.manager,
                       customer_client.currency_code,
                       customer_client.status
                FROM customer_client
                WHERE customer_client.level = 1
                  AND customer_client.status = 'ENABLED'
            `);

            return rows.map(r => ({
                id: String(r.customer_client.id),
                name: r.customer_client.descriptive_name || `Client ${r.customer_client.id}`,
                isManager: r.customer_client.manager,
                currencyCode: r.customer_client.currency_code
            }));
        } catch (err) {
            const errorMsg = err.errors ? (Array.isArray(err.errors) ? err.errors[0]?.message : JSON.stringify(err.errors)) : (err.message || "Unknown API Error");
            logger.error(`[GoogleAds] listClientAccounts(${mccClean}) failed: ${errorMsg}`);
            throw new Error(errorMsg);
        }
    }

    /**
     * List all conversion actions for a given customer.
     * Returns an array of { id, name, type, status }
     */
    async listConversionActions(customerId, mccId, refreshToken, credentials = {}) {
        const client = this._buildClient(credentials);
        const custClean = String(customerId).replace(/-/g, '');
        const mccClean = mccId ? String(mccId).replace(/-/g, '') : custClean;

        const customer = client.Customer({
            customer_id: custClean,
            login_customer_id: mccClean,
            refresh_token: refreshToken
        });

        try {
            const rows = await customer.query(`
                SELECT conversion_action.id,
                       conversion_action.name,
                       conversion_action.type,
                       conversion_action.status,
                       conversion_action.category
                FROM conversion_action
                WHERE conversion_action.status = 'ENABLED'
            `);

            return rows.map(r => ({
                id: String(r.conversion_action.id),
                name: r.conversion_action.name,
                type: r.conversion_action.type,
                category: r.conversion_action.category,
                status: r.conversion_action.status
            }));
        } catch (err) {
            logger.error(`[GoogleAds] listConversionActions(${custClean}) failed: ${err.message}`);
            throw err;
        }
    }

    /**
     * Upload an offline (click) conversion to Google Ads.
     */
    async uploadOfflineConversion({ customerId, mccId, refreshToken, conversionData, credentials = {} }) {
        const client = this._buildClient(credentials);
        const custClean = String(customerId).replace(/-/g, '');
        const mccClean = mccId ? String(mccId).replace(/-/g, '') : custClean;

        const customer = client.Customer({
            customer_id: custClean,
            login_customer_id: mccClean,
            refresh_token: refreshToken
        });

        logger.info(`[GoogleAds] Uploading conversion for customer ${custClean}`);

        try {
            const response = await customer.conversionUploads.uploadClickConversions({
                customer_id: custClean,
                conversions: [conversionData],
                partial_failure: true,
                validate_only: false
            });

            logger.info(`[GoogleAds] Conversion upload success for ${custClean}`);
            return response;
        } catch (err) {
            logger.error(`[GoogleAds] Conversion upload failed: ${err.message}`);
            throw err;
        }
    }
}

module.exports = new GoogleAdsIntegration();
