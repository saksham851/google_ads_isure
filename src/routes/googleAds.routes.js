const express    = require('express');
const router     = express.Router();
const ctrl       = require('../controllers/googleAds.controller');
const { isAuthenticated } = require('../middlewares/auth.middleware');

router.use(isAuthenticated);

// Fetch Manager (MCC) accounts for an agency's Google token
router.get('/manager-accounts',   ctrl.getManagerAccounts);

// Fetch client accounts under a selected MCC
router.get('/client-accounts',    ctrl.getClientAccounts);

// Fetch conversion actions for a selected client account
router.get('/conversion-actions', ctrl.getConversionActions);

// Save the MCC + client account + conversion mapping selection
router.post('/save-mapping',      ctrl.saveMapping);

// Save custom (BYOC) Google Ads credentials
router.post('/save-credentials',  ctrl.saveCredentials);

module.exports = router;
