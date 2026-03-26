const Agency = require('../models/agency.model');
const ConversionLog = require('../models/conversionLog.model');
const WebhookLog = require('../models/webhookLog.model');

const agencyController = {

    // ─────────────────────────────────────────────────────────────────
    // GET /agencies
    // ─────────────────────────────────────────────────────────────────
    index: async (req, res) => {
        try {
            const page = parseInt(req.query.page) || 1;
            const limit = 10;
            const skip = (page - 1) * limit;

            const [agencies, totalAgencies] = await Promise.all([
                Agency.find().sort({ createdAt: -1 }).skip(skip).limit(limit),
                Agency.countDocuments()
            ]);

            const totalPages = Math.ceil(totalAgencies / limit);

            res.render('agencies/index', {
                title: 'Sub-Accounts / Agencies',
                agencies,
                currentPage: page,
                totalPages,
                totalAgencies,
                activePage: 'agencies',
                layout: 'layouts/dashboard_layout'
            });
        } catch (error) {
            console.error('Error fetching agencies:', error);
            req.flash('error', 'Could not load agencies');
            res.redirect('/dashboard');
        }
    },

    // ─────────────────────────────────────────────────────────────────
    // GET /agencies/:locationId/detail
    // Per-agency detail: GHL status, Google Ads connection, dropdowns
    // ─────────────────────────────────────────────────────────────────
    detail: async (req, res) => {
        try {
            const agency = await Agency.findOne({ locationId: req.params.locationId });
            if (!agency) {
                req.flash('error', 'Agency not found');
                return res.redirect('/agencies');
            }

            const recentLogs = await ConversionLog
                .find({ agencyId: agency._id })
                .sort({ createdAt: -1 })
                .limit(10);

            const webhookLogs = await WebhookLog
                .find({
                    $or: [
                        { 'payload.location_id': agency.locationId },
                        { 'payload.contact.locationId': agency.locationId }
                    ]
                })
                .sort({ createdAt: -1 })
                .limit(5);

            // Added flags used by detail.ejs
            const ghlConnected = !!(agency.ghlAccessToken);
            const googleConnected = !!(agency.googleRefreshToken);

            res.render('agencies/detail', {
                title: `${agency.agencyName || 'Agency'} — Configuration`,
                agency,
                ghlConnected,
                googleConnected,
                recentLogs,
                webhookLogs,
                activePage: 'agencies',
                layout: 'layouts/dashboard_layout'
            });
        } catch (error) {
            console.error('Error loading agency detail:', error);
            req.flash('error', 'Could not load agency details');
            res.redirect('/agencies');
        }
    },

    // ─────────────────────────────────────────────────────────────────
    // GET /agencies/create
    // ─────────────────────────────────────────────────────────────────
    createView: (req, res) => {
        res.render('agencies/config', {
            title: 'Add Agency / Sub-Account',
            activePage: 'agencies',
            layout: 'layouts/dashboard_layout'
        });
    },

    // ─────────────────────────────────────────────────────────────────
    // POST /agencies
    // Manual agency creation 
    // ─────────────────────────────────────────────────────────────────
    store: async (req, res) => {
        try {
            const { agencyId, agencyName, locationId } = req.body;
            const newAgency = new Agency({ agencyId, agencyName, locationId });
            await newAgency.save();
            req.flash('success', 'Sub-account added.');
            res.redirect('/agencies');
        } catch (error) {
            req.flash('error', error.message);
            res.redirect('/agencies/create');
        }
    },

    // ─────────────────────────────────────────────────────────────────
    // POST /agencies/:locationId/disconnect-ghl
    // ─────────────────────────────────────────────────────────────────
    disconnectGHL: async (req, res) => {
        try {
            await Agency.findOneAndUpdate(
                { locationId: req.params.locationId },
                {
                    ghlAccessToken: null,
                    ghlRefreshToken: null,
                    ghlTokenExpiry: null
                }
            );
            res.json({ success: true });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    },

    // ─────────────────────────────────────────────────────────────────
    // DELETE /agencies/:locationId
    // ─────────────────────────────────────────────────────────────────
    deleteAgency: async (req, res) => {
        try {
            const agency = await Agency.findOne({ locationId: req.params.locationId });
            if (!agency) return res.status(404).json({ success: false, error: 'Agency not found' });

            // Delete associated logs too if needed
            await ConversionLog.deleteMany({ agencyId: agency._id });
            await agency.deleteOne();

            res.json({ success: true });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    }
};

module.exports = agencyController;
