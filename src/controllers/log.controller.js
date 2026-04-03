const ConversionLog = require('../models/conversionLog.model');
const WebhookLog = require('../models/webhookLog.model');
const Agency = require('../models/agency.model');

const logController = {
    // GET /logs
    index: async (req, res) => {
        try {
            const { locationId, days, page, search } = req.query;
            const currentPage = parseInt(page) || 1;
            const limit = 10;
            const skip = (currentPage - 1) * limit;

            let filter = {};
            let selectedAgencyName = null;
            const user = req.session.user;

            let agenciesQuery = {};
            if (user.role !== 'superadmin') {
                if (user.agencyId) agenciesQuery = { agencyId: user.agencyId };
                else if (user.locationId) agenciesQuery = { locationId: user.locationId };
                else agenciesQuery = { locationId: 'none' };
            }

            const activeLocationId = req.query.locationId || req.query.location_id || req.session.activeLocationId;

            if (search) {
                // To search by lead email, we might need a join or search by gclid/status
                filter.$or = [
                    { gclid: { $regex: search, $options: 'i' } },
                    { conversionAction: { $regex: search, $options: 'i' } }
                ];
            }

            if (days && days !== 'all') {
                const date = new Date();
                date.setDate(date.getDate() - parseInt(days));
                filter.createdAt = { $gte: date };
            }

            if (activeLocationId) {
                const agency = await Agency.findOne({ locationId: activeLocationId });
                if (agency) {
                    filter.agencyId = agency._id;
                    selectedAgencyName = agency.agencyName;
                }
            } else if (user.role !== 'superadmin') {
                const userAgencies = await Agency.find(agenciesQuery);
                filter.agencyId = { $in: userAgencies.map(a => a._id) };
            }

            const [agencies, logs, totalLogs] = await Promise.all([
                Agency.find(agenciesQuery).sort({ agencyName: 1 }),
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
                search: search || '',
                user,
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
            const { locationId, days, page, eventType, search } = req.query;
            const currentPage = parseInt(page) || 1;
            const limit = 10;
            const skip = (currentPage - 1) * limit;

            let filter = {};
            let selectedAgencyName = null;
            const user = req.session.user;

            let agenciesQuery = {};
            if (user.role !== 'superadmin') {
                if (user.agencyId) agenciesQuery = { agencyId: user.agencyId };
                else if (user.locationId) agenciesQuery = { locationId: user.locationId };
                else agenciesQuery = { locationId: 'none' };
            }

            const activeLocationId = req.query.locationId || req.query.location_id || req.session.activeLocationId;

            if (search) {
                filter.$or = [
                    { eventType: { $regex: search, $options: 'i' } },
                    { errorMessage: { $regex: search, $options: 'i' } },
                    { 'payload.contact.email': { $regex: search, $options: 'i' } }
                ];
            }

            // Date Range Filter
            if (days && days !== 'all') {
                const date = new Date();
                date.setDate(date.getDate() - parseInt(days));
                filter.createdAt = { $gte: date };
            }

            // Agency Filter
            if (activeLocationId) {
                const locationFilter = {
                    $or: [
                        { locationId: activeLocationId },
                        { 'payload.location_id': activeLocationId },
                        { 'payload.contact.locationId': activeLocationId }
                    ]
                };

                if (filter.$or) {
                    const searchFilter = filter.$or;
                    delete filter.$or;
                    filter = { ...filter, $and: [ { $or: searchFilter }, locationFilter ] };
                } else {
                    filter = { ...filter, ...locationFilter };
                }
                
                const agency = await Agency.findOne({ locationId: activeLocationId });
                if (agency) selectedAgencyName = agency.agencyName;
            } else if (user.role !== 'superadmin') {
                const userAgencies = await Agency.find(agenciesQuery);
                const locationIds = userAgencies.map(a => a.locationId);
                const locationFilter = {
                    $or: [
                        { locationId: { $in: locationIds } },
                        { 'payload.location_id': { $in: locationIds } },
                        { 'payload.contact.locationId': { $in: locationIds } }
                    ]
                };

                if (filter.$or) {
                    const searchFilter = filter.$or;
                    delete filter.$or;
                    filter = { ...filter, $and: [ { $or: searchFilter }, locationFilter ] };
                } else {
                    filter = { ...filter, ...locationFilter };
                }
            }

            // Event Type Filter
            if (eventType) {
                filter.eventType = eventType;
            }

            const [agencies, rawLogs, totalLogs] = await Promise.all([
                Agency.find(agenciesQuery).sort({ agencyName: 1 }),
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
                const locId = log.locationId || log.payload?.location_id || log.payload?.contact?.locationId;
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
                user,
                selectedAgencyName,
                eventType: eventType || '',
                days: days || 'all',
                search: search || '',
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
