const googleAdsAuthService = require('../services/googleAdsAuth.service');
const Agency = require('../models/agency.model');
const logger = require('../utils/logger');

exports.googleLogin = (req, res) => {
    const { locationId } = req.query; // GHL locationId
    if (!locationId) {
        return res.status(400).send('Missing locationId from GHL.');
    }

    // Generate Google Auth URL, passing locationId for context in the state
    const authUrl = googleAdsAuthService.getAuthUrl(locationId);
    res.redirect(authUrl);
};

exports.googleCallback = async (req, res, next) => {
    try {
        const { code, state: locationId } = req.query; // Google sends back the code and our state
        if (!code) {
            return res.status(400).send('Authorization code from Google is missing.');
        }

        const tokens = await googleAdsAuthService.getTokens(code);

        // Update Agency with Google Tokens
        const agency = await Agency.findOneAndUpdate(
            { locationId: locationId },
            {
                googleRefreshToken: tokens.refresh_token,
                $set: { googleAccessToken: tokens.access_token } // Optionally save access token
            },
            { new: true }
        );

        if (!agency) {
            return res.status(404).send('Agency not found for this location ID.');
        }

        logger.info(`Google Ads connected for Location: ${locationId}`);

        // Finally, redirect to a dashboard or configuration page where the user can pick Customer ID
        res.status(200).send(`
      <html>
        <body>
          <h2>Google Ads Connected Successfully!</h2>
          <p>Now, please enter your Google Ads Customer ID in your Dashboard.</p>
        </body>
      </html>
    `);
    } catch (error) {
        logger.error('Error in Google Ads callback', error);
        next(error);
    }
};
