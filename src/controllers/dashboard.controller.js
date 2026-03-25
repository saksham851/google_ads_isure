const Agency         = require('../models/agency.model');
const ConversionLog  = require('../models/conversionLog.model');
const WebhookLog     = require('../models/webhookLog.model');

const dashboardController = {
    index: async (req, res) => {
        try {
            const [agencyCount, conversionCount, webhookCount, failedCount, recentLogs] = await Promise.all([
                Agency.countDocuments(),
                ConversionLog.countDocuments({ status: 'success' }),
                WebhookLog.countDocuments(),
                ConversionLog.countDocuments({ status: 'failed' }),
                ConversionLog.find().populate('leadId').sort({ createdAt: -1 }).limit(10)
            ]);

            return res.render('dashboard', {
                title:      'Dashboard',
                activePage: 'dashboard',
                stats: { agencyCount, conversionCount, webhookCount, failedCount },
                recentLogs,
                layout:     'layouts/dashboard_layout'
            });
        } catch (error) {
            console.error('[Dashboard] Error:', error);
            return res.render('dashboard', {
                title:      'Dashboard',
                activePage: 'dashboard',
                stats: { agencyCount: 0, conversionCount: 0, webhookCount: 0, failedCount: 0 },
                recentLogs: [],
                layout:     'layouts/dashboard_layout'
            });
        }
    }
};

module.exports = dashboardController;
