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
        // Process and wait for the result
        const result = await webhookService.handleGHLWebhook(payload, locationId, eventType);

        // Update log to success
        webLog.status = 'success';
        await webLog.save();

        // Send successful response
        res.status(200).json({ 
            received: true, 
            status: 'processed',
            leadId: result.leadId 
        });

    } catch (error) {
        logger.error('Webhook processing failed: ', error);
        
        // Update log to error
        webLog.status = 'error';
        webLog.errorMessage = error.message;
        await webLog.save();

        // Send error response
        res.status(500).json({ 
            received: true, 
            status: 'error', 
            message: error.message 
        });
    }
};

exports.verifyWebhook = (req, res) => {
    res.status(200).json({ 
        status: 'active', 
        message: 'GHL Webhook endpoint is reachable. Please use POST for processing data.' 
    });
};
