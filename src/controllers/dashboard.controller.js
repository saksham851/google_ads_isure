const Agency = require('../models/agency.model');
const ConversionLog = require('../models/conversionLog.model');

const dashboardController = {
    index: async (req, res) => {
        try {
            console.log('[Dashboard] Fetching data...');
            const agencyCount = (await Agency.countDocuments()) || 0;
            const conversionCount = (await ConversionLog.countDocuments({ status: 'success' })) || 0;
            const recentLogs = (await ConversionLog.find().populate('leadId').sort({ createdAt: -1 }).limit(5)) || [];

            console.log(`[Dashboard] Stats: agencies=${agencyCount}, conversions=${conversionCount}`);

            return res.render('dashboard', { 
                title: 'Overview', 
                activePage: 'dashboard',
                stats: { 
                    agencyCount: agencyCount, 
                    conversionCount: conversionCount 
                },
                recentLogs: recentLogs,
                layout: 'layouts/dashboard_layout' 
            });
        } catch (error) {
            console.error('Dashboard controller error:', error);
            // Fallback for missing stats in case of model errors
            return res.render('dashboard', { 
                title: 'Overview', 
                activePage: 'dashboard',
                stats: { agencyCount: 0, conversionCount: 0 },
                recentLogs: [],
                layout: 'layouts/dashboard_layout',
                error: 'Error loading some data' 
            });
        }
    }
};

module.exports = dashboardController;
