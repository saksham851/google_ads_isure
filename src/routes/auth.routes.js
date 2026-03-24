const express = require('express');
const authController = require('../controllers/auth.controller');
const googleAdsAuthController = require('../controllers/googleAdsAuth.controller');

const router = express.Router();

router.get('/install', authController.install);
router.get('/callback', authController.callback);

// Google Ads login & callback
router.get('/google-login', googleAdsAuthController.googleLogin);
router.get('/google-callback', googleAdsAuthController.googleCallback);

module.exports = router;

