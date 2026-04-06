const Agency = require('../models/agency.model');
const ConversionLog = require('../models/conversionLog.model');
const WebhookLog = require('../models/webhookLog.model');

const agencyController = {

    // ─────────────────────────────────────────────────────────────────
    // GET /agencies
    // ─────────────────────────────────────────────────────────────────
    index: async (req, res) => {
        try {
            const { page, search } = req.query;
            const currentPage = parseInt(page) || 1;
            const limit = 10;
            const skip = (currentPage - 1) * limit;

            const user = req.session.user;
            let filter = {};

            // Even for superadmin, if they are viewing via GHL (locationId present), we ONLY show that sub-account.
            const activeLocationId = req.query.locationId || req.query.location_id || req.session.activeLocationId;
            
            if (activeLocationId) {
                filter = { locationId: activeLocationId };
            } else if (user.role !== 'superadmin') {
                if (user.agencyId) {
                    filter = { agencyId: user.agencyId };
                } else if (user.locationId) {
                    filter = { locationId: user.locationId };
                } else {
                    filter = { locationId: 'none' };
                }
            }

            if (search) {
                filter.agencyName = { $regex: search, $options: 'i' };
            }

            const [agencies, totalAgencies] = await Promise.all([
                Agency.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
                Agency.countDocuments(filter)
            ]);

            const totalPages = Math.ceil(totalAgencies / limit);

            res.render('agencies/index', {
                title: 'Sub-Accounts / Agencies',
                agencies,
                currentPage,
                totalPages,
                totalAgencies,
                search: search || '',
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
                isGhlEmbedded: req.session.user?.isGhlEmbedded || false,
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
    },

    // ─────────────────────────────────────────────────────────────────
    // POST /agencies/:locationId/webhooks  { name }
    // ─────────────────────────────────────────────────────────────────
    addWebhook: async (req, res) => {
        try {
            const { name } = req.body;
            if (!name || !name.trim()) return res.status(400).json({ success: false, error: 'Webhook name is required.' });

            // Auto-generate URL-safe slug from name
            const slug = name.trim()
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/^-+|-+$/g, '');

            const agency = await Agency.findOne({ locationId: req.params.locationId });
            if (!agency) return res.status(404).json({ success: false, error: 'Sub-account not found.' });

            // Prevent duplicate slugs
            if (agency.customWebhooks.some(w => w.slug === slug)) {
                return res.status(400).json({ success: false, error: `A webhook with slug "${slug}" already exists.` });
            }

            agency.customWebhooks.push({ name: name.trim(), slug });
            await agency.save();

            res.json({ success: true, webhook: { name: name.trim(), slug } });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    },

    // ─────────────────────────────────────────────────────────────────
    // DELETE /agencies/:locationId/webhooks/:slug
    // ─────────────────────────────────────────────────────────────────
    removeWebhook: async (req, res) => {
        try {
            await Agency.findOneAndUpdate(
                { locationId: req.params.locationId },
                { $pull: { customWebhooks: { slug: req.params.slug } } }
            );
            res.json({ success: true });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    },

    // ─────────────────────────────────────────────────────────────────
    // PUT /agencies/:locationId/webhooks/:slug/mapping  { mappingId }
    // ─────────────────────────────────────────────────────────────────
    updateWebhookMapping: async (req, res) => {
        try {
            const { mappingId } = req.body;
            const { locationId, slug } = req.params;

            const agency = await Agency.findOne({ locationId });
            if (!agency) return res.status(404).json({ success: false, error: 'Sub-account not found.' });

            const webhook = agency.customWebhooks.find(w => w.slug === slug);
            if (!webhook) return res.status(404).json({ success: false, error: 'Webhook not found.' });

            // If mappingId is empty, it means "Global"
            webhook.mappingId = mappingId || null;
            await agency.save();

            res.json({ success: true });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    },

    ghlExtension: async (req, res) => {
        try {
            const locationId = req.query.location_id || req.query.locationId; 
            if (!locationId) {
                return res.status(400).send('<h2>Error: Missing Location ID</h2><p>This page must be opened within GoHighLevel.</p>');
            }

            // ── AUTO-SESSION FOR GHL ───────────────────────────────────────────
            if (locationId) req.session.activeLocationId = locationId;

            if (!req.session.user) {
                req.session.user = { 
                    locationId: locationId, 
                    role: 'ghl_user',
                    isGhlEmbedded: true 
                };
            } else {
                // If user already has a session, ensure this flag is set
                req.session.user.isGhlEmbedded = true;
            }

            let agency = await Agency.findOne({ locationId });
            
            // If the agency exists and is fully connected, we can redirect to detail page
            // Otherwise show the setup screen (ghl-extension.ejs)
            const ghlConnected = !!(agency?.ghlAccessToken);
            const googleConnected = !!(agency?.googleRefreshToken);

            if (ghlConnected && googleConnected && agency) {
                // If everything is ready, show them the full dashboard (detail view)
                // but we use the detail template logic
                return res.redirect(`/agencies/${locationId}/detail`);
            }

            // Otherwise, show the basic extension/onboarding screen
            res.render('ghl-extension', {
                title: 'Authentication Settings',
                agency: agency || { locationId, agencyName: 'New Sub-account' },
                ghlConnected,
                googleConnected,
                layout: false
            });
        } catch (error) {
            console.error('[GHL Extension] Error:', error);
            res.status(500).send('Internal Server Error');
        }
    }
};

module.exports = agencyController;
