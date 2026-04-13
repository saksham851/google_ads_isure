const webhookService = require('../services/webhook.service');
const WebhookLog = require('../models/webhookLog.model');
const logger = require('../utils/logger');
const fs = require('fs');
const path = require('path');
const os = require('os');
const connectDB = require('../config/database');

exports.ghlWebhook = async (req, res, next) => {
    const payload = req.body;
    const headers = req.headers;
    const locationId = req.params.locationId || null;
    const eventType = req.params.slug || req.params.eventType || 'general';
    
    // Ensure DB is connected before doing anything
    await connectDB();

    // ── RAW DATA LOGGING TO FILE ──────────────────────────────────
    try {
        // Use /tmp or OS temp dir if running on Vercel/Read-only FS
        const logDir = process.env.VERCEL ? path.join(os.tmpdir(), 'logs') : path.join(process.cwd(), 'logs');
        if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
        
        const logEntry = `[${new Date().toISOString()}] | LOC: ${locationId} | TYPE: ${eventType}\n` + 
                         `PAYLOAD: ${JSON.stringify(payload)}\n` + 
                         `------------------------------------------------------------------\n`;
        
        fs.appendFileSync(path.join(logDir, 'webhooks_raw.log'), logEntry);
    } catch (err) {
        logger.error('[Webhook Logger] Failed to write raw log file: ', err);
    }
    // ──────────────────────────────────────────────────────────────

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
        
        try {
            // Attempt to update log to error, but don't let it crash the response
            webLog.status = 'error';
            webLog.errorMessage = error.message;
            await webLog.save();
        } catch (saveErr) {
            logger.error('Failed to save error status to WebhookLog:', saveErr);
        }

        // ALWAYS send a response to avoid timeouts
        if (!res.headersSent) {
            res.status(500).json({ 
                received: true, 
                status: 'error', 
                message: error.message 
            });
        }
    }
};

exports.verifyWebhook = (req, res) => {
    res.status(200).json({ 
        status: 'active', 
        message: 'GHL Webhook endpoint is reachable. Please use POST for processing data.' 
    });
};
