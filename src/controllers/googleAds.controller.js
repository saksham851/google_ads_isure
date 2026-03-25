const Agency              = require('../models/agency.model');
const googleAdsIntegration = require('../integrations/googleAds.integration');
const googleAdsAuthService = require('../services/googleAdsAuth.service');
const logger              = require('../utils/logger');

// ─────────────────────────────────────────────────────────────────────────────
// GET /google-ads/manager-accounts?locationId=xxx
// Returns list of Manager (MCC) accounts for the agency's Google token
// ─────────────────────────────────────────────────────────────────────────────
exports.getManagerAccounts = async (req, res) => {
    try {
        const { locationId } = req.query;
        if (!locationId) return res.status(400).json({ error: 'locationId is required' });

        const agency = await Agency.findOne({ locationId });
        if (!agency) return res.status(404).json({ error: 'Agency not found' });
        if (!agency.googleRefreshToken) return res.status(400).json({ error: 'Google Ads not connected for this agency' });

        const accounts = await googleAdsIntegration.listManagerAccounts(agency.googleRefreshToken);
        res.json({ success: true, accounts });
    } catch (err) {
        logger.error('[GoogleAdsCtrl] getManagerAccounts error:', err.message);
        res.status(500).json({ error: err.message });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /google-ads/client-accounts?locationId=xxx&mccId=123456
// Returns client accounts under a specific MCC
// ─────────────────────────────────────────────────────────────────────────────
exports.getClientAccounts = async (req, res) => {
    try {
        const { locationId, mccId } = req.query;
        if (!locationId || !mccId) return res.status(400).json({ error: 'locationId and mccId are required' });

        const agency = await Agency.findOne({ locationId });
        if (!agency) return res.status(404).json({ error: 'Agency not found' });
        if (!agency.googleRefreshToken) return res.status(400).json({ error: 'Google Ads not connected' });

        const accounts = await googleAdsIntegration.listClientAccounts(mccId, agency.googleRefreshToken);
        res.json({ success: true, accounts });
    } catch (err) {
        logger.error('[GoogleAdsCtrl] getClientAccounts error:', err.message);
        res.status(500).json({ error: err.message });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /google-ads/conversion-actions?locationId=xxx&customerId=yyy&mccId=zzz
// Returns enabled conversion actions for a customer
// ─────────────────────────────────────────────────────────────────────────────
exports.getConversionActions = async (req, res) => {
    try {
        const { locationId, customerId, mccId } = req.query;
        if (!locationId || !customerId) return res.status(400).json({ error: 'locationId and customerId are required' });

        const agency = await Agency.findOne({ locationId });
        if (!agency) return res.status(404).json({ error: 'Agency not found' });
        if (!agency.googleRefreshToken) return res.status(400).json({ error: 'Google Ads not connected' });

        const actions = await googleAdsIntegration.listConversionActions(customerId, mccId, agency.googleRefreshToken);
        res.json({ success: true, actions });
    } catch (err) {
        logger.error('[GoogleAdsCtrl] getConversionActions error:', err.message);
        res.status(500).json({ error: err.message });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /google-ads/save-mapping
// Body: { locationId, mccId, mccName, customerId, customerName, conversionMappings[] }
// Saves the selected MCC, client account, and conversion mappings to the agency
// ─────────────────────────────────────────────────────────────────────────────
exports.saveMapping = async (req, res) => {
    try {
        const { locationId, mccId, mccName, customerId, customerName, conversionMappings } = req.body;
        if (!locationId || !customerId) return res.status(400).json({ error: 'locationId and customerId are required' });

        const agency = await Agency.findOneAndUpdate(
            { locationId },
            {
                googleMccId:          mccId   || null,
                googleMccName:        mccName || null,
                googleAdsCustomerId:  customerId,
                googleAdsAccountName: customerName || null,
                conversionMappings:   Array.isArray(conversionMappings) ? conversionMappings : []
            },
            { new: true }
        );

        if (!agency) return res.status(404).json({ error: 'Agency not found' });

        logger.info(`[GoogleAdsCtrl] Saved Google Ads mapping for agency ${agency._id}`);
        res.json({ success: true, agency });
    } catch (err) {
        logger.error('[GoogleAdsCtrl] saveMapping error:', err.message);
        res.status(500).json({ error: err.message });
    }
};
