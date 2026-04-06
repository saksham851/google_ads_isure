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
    const scopes = 'contacts.readonly contacts.write objects/schema.readonly objects/schema.write objects/record.readonly objects/record.write locations/customFields.readonly locations/customFields.write locations.readonly';
    const redirectUri = process.env.GHL_REDIRECT_URI || 'http://localhost:3000/auth/callback';
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

        // Redirect to agency detail page so user can now connect Google Ads
        // If the request came from inside the dashboard (session exists), redirect there
        if (req.session && req.session.user) {
            req.flash('success', `GoHighLevel connected successfully for: ${agency.agencyName}`);
            return res.redirect(`/agencies/${agency.locationId}/detail`);
        }

        // Otherwise show a simple success page (GHL iframe context)
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>App Installed</title>
                <style>
                    body { font-family: Arial, sans-serif; display: flex; align-items: center;
                           justify-content: center; min-height: 100vh; margin: 0; background: #f8f9fa; }
                    .card { background: #fff; border-radius: 12px; padding: 40px;
                            text-align: center; box-shadow: 0 2px 12px rgba(0,0,0,0.1); }
                    .icon { font-size: 48px; margin-bottom: 16px; }
                    h2 { color: #1a73e8; margin: 0 0 8px; }
                    p  { color: #5f6368; }
                </style>
            </head>
            <body>
                <div class="card">
                    <div class="icon">✅</div>
                    <h2>App Installed Successfully!</h2>
                    <p>GoHighLevel is now connected to the Google Ads Tracking System.</p>
                    <p><strong>Agency:</strong> ${agency.agencyName}</p>
                    <p>You can now close this window and configure Google Ads in your dashboard.</p>
                </div>
            </body>
            </html>
        `);
    } catch (error) {
        logger.error('[GHL] Error in OAuth callback:', error);
        next(error);
    }
};
