const ghlAuthService = require('../services/ghlAuth.service');
const dotenv = require('dotenv');
dotenv.config();
const logger = require('../utils/logger');

/**
 * GET /auth/install
 * Initiates GHL OAuth — redirects to GHL marketplace chooselocation page.
 * The user selects which sub-account (location) to install the app in.
 */
exports.install = (req, res) => {
    // Exact scopes from your project
    const scopes = 'contacts.readonly contacts.write objects/schema.readonly objects/schema.write objects/record.readonly objects/record.write locations/customFields.readonly locations/customFields.write locations.readonly users.readonly';
    const baseUrl = process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;
    const redirectUri = process.env.GHL_REDIRECT_URI || `${baseUrl}/auth/callback`;
    const clientId = process.env.GHL_CLIENT_ID || '69aad8e0fabd7b425927d40c-mnh0zlkv';
    const versionId = clientId.split('-')[0]; // Dynamically derive versionId from clientId

    // Construct the URL EXACTLY as per your working example (using + for spaces in scopes)
    const encodedScopes = scopes.split(' ').join('+');
    let installUrl = `https://marketplace.gohighlevel.com/oauth/chooselocation?response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&client_id=${clientId}&scope=${encodedScopes}&version_id=${versionId}`;

    // If we have a locationId from GHL iframe, pass it through to pre-select for the user
    const locationId = req.query.location_id || req.query.locationId;
    if (locationId) {
        installUrl += `&location_id=${locationId}`;
    }

    res.redirect(installUrl);
};

/**
 * GET /auth/callback
 * GHL redirects here with ?code=xxx after the user installs the app.
 * Exchanges code for tokens and saves/updates the agency record.
 */
exports.callback = async (req, res, next) => {
    try {
        const { code } = req.query;
        if (!code) {
            return res.status(400).send('<h2>Authorization code is missing.</h2>');
        }

        const agency = await ghlAuthService.handleCallback(code, req.session?.user);
        logger.info(`[GHL] App installed for Agency/Location: ${agency.agencyId} (${agency.locationId})`);

        // Determine redirect target (Specific App Page in GHL or fallback)
        const redirectUrl = agency.locationId 
            ? `https://app.gohighlevel.com/v2/location/${agency.locationId}/custom-page-link/69ce05e3701f10ef85d0b155`
            : `https://app.gohighlevel.com/v2/settings/marketplace/installed_apps`;

        if (req.session && req.session.user) {
            req.flash('success', `GoHighLevel connected successfully for: ${agency.agencyName}`);
            return res.redirect(redirectUrl);
        }

        // Otherwise, redirect them straight to their GoHighLevel sub-account dashboard
        return res.redirect(redirectUrl);
    } catch (error) {
        logger.error('[GHL] Error in OAuth callback:', error);
        next(error);
    }
};
