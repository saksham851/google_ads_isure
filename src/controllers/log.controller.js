const ConversionLog = require('../models/conversionLog.model');
const WebhookLog = require('../models/webhookLog.model');

const logController = {
    // GET /logs
    index: async (req, res) => {
        try {
            const logs = await ConversionLog.find()
                .populate('leadId')
                .sort({ createdAt: -1 })
                .limit(100);
            
            res.render('logs/index', { 
                title: 'Conversion Logs', 
                logs, 
                activePage: 'logs',
                layout: 'layouts/dashboard_layout' 
            });
        } catch (error) {
            console.error('Error fetching logs:', error);
            req.flash('error', 'Could not load conversion logs');
            res.redirect('/dashboard');
        }
    },

    // GET /webhooks-logs
    webhookLogs: async (req, res) => {
        try {
            const logs = await WebhookLog.find()
                .sort({ createdAt: -1 })
                .limit(100);
            
            res.render('logs/webhooks', { 
                title: 'Webhook Logs', 
                logs, 
                activePage: 'webhooks',
                layout: 'layouts/dashboard_layout' 
            });
        } catch (error) {
            console.error('Error fetching webhook logs:', error);
            req.flash('error', 'Could not load webhook logs');
            res.redirect('/dashboard');
        }
    }
};

module.exports = logController;
