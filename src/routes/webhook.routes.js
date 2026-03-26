const express = require('express');
const webhookController = require('../controllers/webhook.controller');

const router = express.Router();

router.post('/ghl', webhookController.ghlWebhook);
router.post('/ghl/:locationId', webhookController.ghlWebhook);
router.post('/ghl/:locationId/:eventType', webhookController.ghlWebhook);

module.exports = router;
