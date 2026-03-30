const webhookService = require('../services/webhook.service');
const WebhookLog = require('../models/webhookLog.model');
const logger = require('../utils/logger');

exports.ghlWebhook = async (req, res, next) => {
    const payload = req.body;
    const headers = req.headers;
    const locationId = req.params.locationId || null;
    const eventType = req.params.slug || req.params.eventType || 'general';

    const webLog = new WebhookLog({
        source: 'GHL',
        locationId,
        eventType,
        payload,
        headers,
        status: 'pending'
    });

    try {
        // Respond immediately so GHL doesn't time out
        res.status(200).json({ received: true });

        // Process asynchronously
        webhookService.handleGHLWebhook(payload, locationId, eventType)
            .then(async () => {
                webLog.status = 'success';
                await webLog.save();
            })
            .catch(async (err) => {
                logger.error('Webhook processing failed: ', err);
                webLog.status = 'error';
                webLog.errorMessage = err.message;
                await webLog.save();
            });

    } catch (error) {
        logger.error('Error in Webhook Controller:', error);
        if (!res.headersSent) next(error);
    }
};

exports.verifyWebhook = (req, res) => {
    res.status(200).json({ 
        status: 'active', 
        message: 'GHL Webhook endpoint is reachable. Please use POST for processing data.' 
    });
};
