const googleAdsAuthService = require('../services/googleAdsAuth.service');
const Agency               = require('../models/agency.model');
const logger               = require('../utils/logger');

/**
 * GET /auth/google-login?locationId=xxx
 * Initiates Google OAuth for an agency identified by its GHL locationId.
 * The locationId is stored in session so the callback can retrieve it.
 */
exports.googleLogin = (req, res) => {
    const { locationId } = req.query;
    if (!locationId) {
        return res.status(400).send('<h2>Missing locationId parameter.</h2>');
    }

    // Store locationId in session so callback can look up the agency
    req.session.pendingGoogleLocationId = locationId;

    const authUrl = googleAdsAuthService.getAuthUrl(locationId);
    res.redirect(authUrl);
};

/**
 * GET /auth/google-callback?code=xxx&state=locationId
 * Google redirects here. Exchanges code for tokens and saves them to the agency.
 */
exports.googleCallback = async (req, res, next) => {
    try {
        const { code, state: locationIdFromState } = req.query;

        // Prefer the session-stored locationId, fall back to state param
        const locationId = req.session.pendingGoogleLocationId || locationIdFromState;

        if (!code) {
            return res.status(400).send('<h2>Authorization code from Google is missing.</h2>');
        }
        if (!locationId) {
            return res.status(400).send('<h2>Location context missing. Please start the Google Ads connection again from your dashboard.</h2>');
        }

        // Exchange code for tokens
        const tokens = await googleAdsAuthService.getTokens(code);

        // Calculate expiry
        const expiry = tokens.expiry_date
            ? new Date(tokens.expiry_date)
            : new Date(Date.now() + 3600 * 1000);

        // Update agency record with Google tokens
        const agency = await Agency.findOneAndUpdate(
            { locationId },
            {
                googleRefreshToken: tokens.refresh_token || undefined, // undefined keeps old value if null
                googleAccessToken:  tokens.access_token,
                googleTokenExpiry:  expiry
            },
            { new: true }
        );

        if (!agency) {
            return res.status(404).send(`
                <h2>Agency not found for location: ${locationId}</h2>
                <p>Please ensure the GHL app is installed first before connecting Google Ads.</p>
            `);
        }

        // Clear session key
        delete req.session.pendingGoogleLocationId;

        logger.info(`[GoogleAds] OAuth connected for Location: ${locationId} (Agency: ${agency.agencyName})`);

        // Redirect back to dashboard with success
        if (req.session && req.session.user) {
            req.flash('success', `Google Ads connected for ${agency.agencyName}! Now select your Manager Account below.`);
            return res.redirect(`/agencies/${locationId}/detail`);
        }

        // Fallback success page
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Google Ads Connected</title>
                <style>
                    body { font-family: Arial, sans-serif; display: flex; align-items: center;
                           justify-content: center; min-height: 100vh; margin: 0; background: #f8f9fa; }
                    .card { background: #fff; border-radius: 12px; padding: 40px;
                            text-align: center; box-shadow: 0 2px 12px rgba(0,0,0,0.1); }
                    h2 { color: #1a73e8; }
                    p  { color: #5f6368; }
                </style>
            </head>
            <body>
                <div class="card">
                    <div style="font-size:48px;">🎉</div>
                    <h2>Google Ads Connected!</h2>
                    <p>Agency: <strong>${agency.agencyName}</strong></p>
                    <p>Go back to your dashboard to select your Manager Account and Conversion Actions.</p>
                </div>
            </body>
            </html>
        `);
    } catch (error) {
        logger.error('[GoogleAds] Error in Google callback:', error);
        next(error);
    }
};
