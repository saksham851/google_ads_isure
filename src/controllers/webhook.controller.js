const webhookService = require('../services/webhook.service');
const WebhookLog = require('../models/webhookLog.model');
const logger = require('../utils/logger');

exports.ghlWebhook = async (req, res, next) => {
    const payload = req.body;
    const headers = req.headers;

    const webLog = new WebhookLog({
        source: 'GHL',
        payload: payload,
        headers: headers,
        status: 'pending'
    });

    try {
        // Basic verification - should return 200 immediately to GHL to avoid timeouts
        res.status(200).json({ received: true });

        // Process asynchronously (Fire and forget style, but with logging)
        webhookService.handleGHLWebhook(payload)
            .then(async (result) => {
                webLog.status = 'success';
                await webLog.save();
            })
            .catch(async (err) => {
                logger.error('Webhook processing failed in async handler: ', err);
                webLog.status = 'error';
                webLog.errorMessage = err.message;
                await webLog.save();
            });

    } catch (error) {
        logger.error('Error in Webhook Controller:', error);
        // If it crashed before res.json
        if (!res.headersSent) {
            next(error);
        }
    }
};
