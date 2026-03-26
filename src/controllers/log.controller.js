const ConversionLog = require('../models/conversionLog.model');
const WebhookLog = require('../models/webhookLog.model');
const Agency = require('../models/agency.model');

const logController = {
    // GET /logs
    index: async (req, res) => {
        try {
            const { locationId, days, page } = req.query;
            const currentPage = parseInt(page) || 1;
            const limit = 10;
            const skip = (currentPage - 1) * limit;

            let filter = {};
            let selectedAgencyName = null;

            // Date Range Filter
            if (days && days !== 'all') {
                const date = new Date();
                date.setDate(date.getDate() - parseInt(days));
                filter.createdAt = { $gte: date };
            }

            // Agency Filter
            if (locationId) {
                const agency = await Agency.findOne({ locationId });
                if (agency) {
                    filter.agencyId = agency._id;
                    selectedAgencyName = agency.agencyName;
                }
            }

            const [agencies, logs, totalLogs] = await Promise.all([
                Agency.find().sort({ agencyName: 1 }),
                ConversionLog.find(filter)
                    .populate('leadId')
                    .populate('agencyId')
                    .sort({ createdAt: -1 })
                    .skip(skip)
                    .limit(limit),
                ConversionLog.countDocuments(filter)
            ]);

            const totalPages = Math.ceil(totalLogs / limit);
            
            res.render('logs/index', { 
                title: 'Conversion Logs', 
                logs, 
                agencies,
                activePage: 'logs',
                locationId,
                selectedAgencyName,
                days: days || 'all',
                currentPage,
                totalPages,
                totalLogs,
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
            const { locationId, days, page } = req.query;
            const currentPage = parseInt(page) || 1;
            const limit = 10;
            const skip = (currentPage - 1) * limit;

            let filter = {};
            let selectedAgencyName = null;

            // Date Range Filter
            if (days && days !== 'all') {
                const date = new Date();
                date.setDate(date.getDate() - parseInt(days));
                filter.createdAt = { $gte: date };
            }

            // Agency Filter
            if (locationId) {
                filter = {
                    ...filter,
                    $or: [
                        { 'payload.location_id': locationId },
                        { 'payload.contact.locationId': locationId }
                    ]
                };
                const agency = await Agency.findOne({ locationId });
                if (agency) selectedAgencyName = agency.agencyName;
            }

            const [agencies, rawLogs, totalLogs] = await Promise.all([
                Agency.find().sort({ agencyName: 1 }),
                WebhookLog.find(filter)
                    .sort({ createdAt: -1 })
                    .skip(skip)
                    .limit(limit),
                WebhookLog.countDocuments(filter)
            ]);

            // Map agency names for display
            const agencyMap = {};
            agencies.forEach(a => agencyMap[a.locationId] = a.agencyName);

            const logs = rawLogs.map(log => {
                const locId = log.payload?.location_id || log.payload?.contact?.locationId;
                return {
                    ...log.toObject(),
                    agencyName: agencyMap[locId] || 'Unknown'
                };
            });

            const totalPages = Math.ceil(totalLogs / limit);
            
            res.render('logs/webhooks', { 
                title: 'Webhook Logs', 
                logs, 
                agencies,
                activePage: 'webhooks',
                locationId,
                selectedAgencyName,
                days: days || 'all',
                currentPage,
                totalPages,
                totalLogs,
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
