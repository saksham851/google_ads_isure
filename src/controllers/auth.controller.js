const ghlAuthService = require('../services/ghlAuth.service');
const dotenv = require('dotenv');
dotenv.config();
const logger = require('../utils/logger');

exports.install = (req, res) => {
  // Redirect to GHL Marketplace OAuth page
  const scopes = 'locations.readonly contacts.readonly contacts.write';
  const installUrl = `https://marketplace.gohighlevel.com/oauth/chooselocation?response_type=code&redirect_uri=${process.env.GHL_REDIRECT_URI || 'http://localhost:3000/auth/callback'}&client_id=${process.env.GHL_CLIENT_ID}&scope=${scopes}`;

  res.redirect(installUrl);
};

exports.callback = async (req, res, next) => {
  try {
    const { code } = req.query;
    if (!code) {
      return res.status(400).send('Authorization code is missing.');
    }

    const agency = await ghlAuthService.handleCallback(code);

    logger.info(`GoHighLevel Integration completed for Agency/Location: ${agency.agencyId}`);

    // We can redirect the user to a success page or back to GHL
    res.status(200).send(`
      <html>
        <body>
          <h2>App Installed Successfully</h2>
          <p>Your GoHighLevel account is now connected to our Google Ads Tracking System.</p>
        </body>
      </html>
    `);
  } catch (error) {
    logger.error('Error in OAuth callback', error);
    next(error);
  }
};
