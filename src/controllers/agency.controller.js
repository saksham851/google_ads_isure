const Agency              = require('../models/agency.model');
const ConversionLog        = require('../models/conversionLog.model');
const WebhookLog           = require('../models/webhookLog.model');

const agencyController = {

    // ─────────────────────────────────────────────────────────────────
    // GET /agencies
    // ─────────────────────────────────────────────────────────────────
    index: async (req, res) => {
        try {
            const agencies = await Agency.find().sort({ createdAt: -1 });
            res.render('agencies/index', {
                title:      'Sub-Accounts / Agencies',
                agencies,
                activePage: 'agencies',
                layout:     'layouts/dashboard_layout'
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
                .find({ 'payload.location_id': agency.locationId })
                .sort({ createdAt: -1 })
                .limit(5);

            res.render('agencies/detail', {
                title:       `${agency.agencyName || 'Agency'} — Configuration`,
                agency,
                recentLogs,
                webhookLogs,
                activePage:  'agencies',
                layout:      'layouts/dashboard_layout'
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
            title:      'Add Agency / Sub-Account',
            activePage: 'agencies',
            layout:     'layouts/dashboard_layout'
        });
    },

    // ─────────────────────────────────────────────────────────────────
    // POST /agencies
    // Manual agency creation (for cases where GHL OAuth isn't used)
    // ─────────────────────────────────────────────────────────────────
    store: async (req, res) => {
        try {
            const { agencyId, agencyName, locationId } = req.body;

            const newAgency = new Agency({ agencyId, agencyName, locationId });
            await newAgency.save();

            req.flash('success', 'Sub-account added. Now connect GoHighLevel and Google Ads.');
            res.redirect('/agencies');
        } catch (error) {
            console.error('Error saving agency:', error);
            req.flash('error', error.message || 'Error saving agency');
            res.redirect('/agencies/create');
        }
    }
};

module.exports = agencyController;
