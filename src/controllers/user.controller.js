const User = require('../models/User');
const Agency = require('../models/agency.model');
const ConversionLog = require('../models/conversionLog.model');
const WebhookLog = require('../models/webhookLog.model');

const userController = {
    // GET /users
    index: async (req, res) => {
        try {
            const page = parseInt(req.query.page) || 1;
            const skip = (page - 1) * 10;
            const search = req.query.search || '';

            let filter = {};
            if (search) {
                filter = { email: { $regex: search, $options: 'i' } };
            }

            const [users, totalUsers] = await Promise.all([
                User.find(filter).sort({ createdAt: -1 }).skip(skip).limit(10),
                User.countDocuments(filter)
            ]);

            // For each user, count their agencies
            const usersWithStats = await Promise.all(users.map(async (u) => {
                let agencyFilter = {};
                if (u.locationIds && u.locationIds.length > 0) {
                    agencyFilter = { locationId: { $in: u.locationIds } };
                } else if (u.agencyId) {
                    agencyFilter = { agencyId: u.agencyId };
                } else {
                    return { ...u._doc, agencyCount: 0, agencyNames: 'None', agencyListData: [] };
                }

                const userAgencies = await Agency.find(agencyFilter).select('subAccountName locationId');
                const agencyListData = userAgencies.map(a => ({ name: a.subAccountName, locationId: a.locationId }));
                const agencyNames = userAgencies.map(a => a.subAccountName).filter(Boolean).sort().join(', ') || 'No accounts';
                return { ...u._doc, agencyCount: userAgencies.length, agencyNames, agencyListData };
            }));

            res.render('users/index', {
                title: 'User Management',
                activePage: 'users',
                users: usersWithStats,
                currentPage: page,
                totalPages: Math.ceil(totalUsers / 10),
                search,
                layout: 'layouts/dashboard_layout'
            });
        } catch (error) {
            console.error('[UserController] index error:', error);
            res.redirect('/dashboard');
        }
    },

    // GET /users/:id
    show: async (req, res) => {
        try {
            const user = await User.findById(req.params.id);
            if (!user) return res.redirect('/users');

            // Find agencies linked to this user
            let agencyFilter = {};
            if (user.locationIds && user.locationIds.length > 0) {
                agencyFilter = { locationId: { $in: user.locationIds } };
            } else if (user.agencyId) {
                agencyFilter = { agencyId: user.agencyId };
            } else {
                agencyFilter = { _id: null };
            }

            const agencies = await Agency.find(agencyFilter);
            const agencyObjectIds = agencies.map(a => a._id);
            const locationIds = agencies.map(a => a.locationId);

            // Fetch logs specifically for this user's agencies
            const [conversionLogs, webhookLogs] = await Promise.all([
                ConversionLog.find({ agencyId: { $in: agencyObjectIds } }).sort({ createdAt: -1 }).limit(20).populate('leadId').populate('agencyId'),
                WebhookLog.find({ 
                    $or: [
                        { locationId: { $in: locationIds } },
                        { 'payload.location_id': { $in: locationIds } }
                    ]
                }).sort({ createdAt: -1 }).limit(20)
            ]);

            res.render('users/detail', {
                title: `Manage User: ${user.email}`,
                activePage: 'users',
                managedUser: user,
                agencies,
                conversionLogs,
                webhookLogs,
                layout: 'layouts/dashboard_layout'
            });
        } catch (error) {
            console.error('[UserController] show error:', error);
            res.redirect('/users');
        }
    }
};

module.exports = userController;
