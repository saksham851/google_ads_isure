const Agency         = require('../models/agency.model');
const ConversionLog  = require('../models/conversionLog.model');
const WebhookLog     = require('../models/webhookLog.model');

const dashboardController = {
    index: async (req, res) => {
        try {
            const page = parseInt(req.query.page) || 1;
            const limit = 5;
            const skip = (page - 1) * limit;

            const user = req.session.user;
            let logsFilter = {};
            let agencyFilter = {};
            let webhookFilter = {};

            if (user.role !== 'superadmin') {
                const activeLocationId = req.query.locationId || req.query.location_id || req.session.activeLocationId;

                if (activeLocationId) {
                    // Filter specifically for the active GHL sub-account (Marketplace app inside location)
                    agencyFilter = { locationId: activeLocationId };
                    webhookFilter = { locationId: activeLocationId };
                    
                    const agency = await Agency.findOne({ locationId: activeLocationId });
                    if (agency) {
                        logsFilter = { agencyId: agency._id };
                    } else {
                        logsFilter = { agencyId: null }; 
                    }
                } else if (user.agencyId) {
                    const agencies = await Agency.find({ agencyId: user.agencyId });
                    const locationIds = agencies.map(a => a.locationId);
                    const agencyObjectIds = agencies.map(a => a._id);
                    
                    agencyFilter = { locationId: { $in: locationIds } };
                    webhookFilter = { locationId: { $in: locationIds } };
                    logsFilter = { agencyId: { $in: agencyObjectIds } };
                } else if (user.locationId) {
                    agencyFilter = { locationId: user.locationId };
                    webhookFilter = { locationId: user.locationId };
                    
                    const agency = await Agency.findOne({ locationId: user.locationId });
                    if (agency) {
                        logsFilter = { agencyId: agency._id };
                    } else {
                        logsFilter = { agencyId: null }; 
                    }
                } else {
                    // Fallback if neither exists
                    agencyFilter = { locationId: null };
                    webhookFilter = { locationId: null };
                    logsFilter = { agencyId: null };
                }
            }

            const [agencyCount, conversionCount, webhookCount, failedCount, recentLogs, totalRecentLogs] = await Promise.all([
                Agency.countDocuments(agencyFilter),
                ConversionLog.countDocuments({ ...logsFilter, status: 'success' }),
                WebhookLog.countDocuments(webhookFilter),
                ConversionLog.countDocuments({ ...logsFilter, status: 'failed' }),
                ConversionLog.find(logsFilter).populate('leadId').sort({ createdAt: -1 }).skip(skip).limit(limit),
                ConversionLog.countDocuments(logsFilter)
            ]);

            const totalPages = Math.ceil(totalRecentLogs / limit);

            return res.render('dashboard', {
                title:      'Dashboard',
                activePage: 'dashboard',
                stats: { agencyCount, conversionCount, webhookCount, failedCount },
                recentLogs,
                currentPage: page,
                totalPages,
                totalRecentLogs,
                layout:     'layouts/dashboard_layout'
            });
        } catch (error) {
            console.error('[Dashboard] Error:', error);
            return res.render('dashboard', {
                title:      'Dashboard',
                activePage: 'dashboard',
                stats: { agencyCount: 0, conversionCount: 0, webhookCount: 0, failedCount: 0 },
                recentLogs: [],
                currentPage: 1,
                totalPages: 0,
                totalRecentLogs: 0,
                layout:     'layouts/dashboard_layout'
            });
        }
    }
};

module.exports = dashboardController;
