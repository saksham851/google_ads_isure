const ConversionLog = require('../models/conversionLog.model');
const WebhookLog = require('../models/webhookLog.model');
const Agency = require('../models/agency.model');
const User = require('../models/User');

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

            const activeLocationId = req.query.locationId || req.query.location_id || req.session.activeLocationId;
            const isSuperAdmin = user.role === 'superadmin';
            let agenciesQuery = {};
            
            if (!isSuperAdmin && activeLocationId) {
                agenciesQuery = { locationId: activeLocationId };
            } else if (!isSuperAdmin) {
                if (user.agencyId) agenciesQuery = { agencyId: user.agencyId };
                else if (user.locationIds && user.locationIds.length > 0) agenciesQuery = { locationId: { $in: user.locationIds } };
                else agenciesQuery = { locationId: 'none' };
            }


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

            if (!isSuperAdmin && activeLocationId) {
                const agency = await Agency.findOne({ locationId: activeLocationId });
                if (agency) {
                    filter.agencyId = agency._id;
                    selectedAgencyName = agency.agencyName;
                }
            } else if (!isSuperAdmin) {
                const userAgencies = await Agency.find(agenciesQuery);
                filter.agencyId = { $in: userAgencies.map(a => a._id) };
            } else if (isSuperAdmin && req.query.userId) {
                // Global filter by user for superadmin
                const targetUser = await User.findById(req.query.userId);
                if (targetUser) {
                    let targetAgenciesQuery = {};
                    if (targetUser.locationIds && targetUser.locationIds.length > 0) targetAgenciesQuery = { locationId: { $in: targetUser.locationIds } };
                    else if (targetUser.agencyId) targetAgenciesQuery = { agencyId: targetUser.agencyId };
                    else targetAgenciesQuery = { _id: null };

                    const userAgencies = await Agency.find(targetAgenciesQuery);
                    filter.agencyId = { $in: userAgencies.map(a => a._id) };
                    res.locals.filteredByUserName = targetUser.email;
                }
            } else if (isSuperAdmin && activeLocationId) {
                const agency = await Agency.findOne({ locationId: activeLocationId });
                if (agency) filter.agencyId = agency._id;
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

            const activeLocationId = req.query.locationId || req.query.location_id || req.session.activeLocationId;
            const isSuperAdmin = user.role === 'superadmin';
            let agenciesQuery = {};
            
            if (!isSuperAdmin && activeLocationId) {
                agenciesQuery = { locationId: activeLocationId };
            } else if (!isSuperAdmin) {
                if (user.agencyId) agenciesQuery = { agencyId: user.agencyId };
                else if (user.locationIds && user.locationIds.length > 0) agenciesQuery = { locationId: { $in: user.locationIds } };
                else agenciesQuery = { locationId: 'none' };
            }


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

            // Agency & Location Filter
            if (!isSuperAdmin) {
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
                } else {
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
            } else if (isSuperAdmin && req.query.userId) {
                const targetUser = await User.findById(req.query.userId);
                if (targetUser) {
                    let targetAgenciesQuery = {};
                    if (targetUser.locationIds && targetUser.locationIds.length > 0) targetAgenciesQuery = { locationId: { $in: targetUser.locationIds } };
                    else if (targetUser.agencyId) targetAgenciesQuery = { agencyId: targetUser.agencyId };
                    else targetAgenciesQuery = { _id: 'none' };

                    const userAgencies = await Agency.find(targetAgenciesQuery);
                    const locationIds = userAgencies.map(a => a.locationId);
                    filter.$or = [
                        { locationId: { $in: locationIds } },
                        { 'payload.location_id': { $in: locationIds } }
                    ];
                    res.locals.filteredByUserName = targetUser.email;
                }
            } else if (activeLocationId) {
                // Superadmin manually filtering via select or URL? Still resolve the name
               const agency = await Agency.findOne({ locationId: activeLocationId });
               if (agency) selectedAgencyName = agency.agencyName;

               // Still apply the specific filter if one is actually requested but let them clear it easily
               if (req.query.locationId || req.query.location_id) {
                    filter.locationId = activeLocationId;
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
