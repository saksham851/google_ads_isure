const express = require('express');
const webhookController = require('../controllers/webhook.controller');

const router = express.Router();

router.post('/ghl', webhookController.ghlWebhook);

module.exports = router;
