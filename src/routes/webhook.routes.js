const express = require('express');
const webhookController = require('../controllers/webhook.controller');

const router = express.Router();

// POST for data processing
router.post('/ghl', webhookController.ghlWebhook);
router.post('/ghl/:locationId', webhookController.ghlWebhook);
router.post('/ghl/:locationId/webhook', webhookController.ghlWebhook);
router.post('/ghl/:locationId/:slug', webhookController.ghlWebhook);
router.post('/ghl/:locationId/:slug/webhook', webhookController.ghlWebhook);

// GET for browser verification
router.get('/ghl', webhookController.verifyWebhook);
router.get('/ghl/:locationId', webhookController.verifyWebhook);
router.get('/ghl/:locationId/webhook', webhookController.verifyWebhook);
router.get('/ghl/:locationId/:slug', webhookController.verifyWebhook);
router.get('/ghl/:locationId/:slug/webhook', webhookController.verifyWebhook);

module.exports = router;
