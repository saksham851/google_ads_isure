const Agency = require('../models/agency.model');

const agencyController = {
    // GET /agencies
    index: async (req, res) => {
        try {
            const agencies = await Agency.find().sort({ createdAt: -1 });
            res.render('agencies/index', { 
                title: 'Agencies', 
                agencies, 
                activePage: 'agencies',
                layout: 'layouts/dashboard_layout' 
            });
        } catch (error) {
            console.error('Error fetching agencies:', error);
            req.flash('error', 'Could not load agencies');
            res.redirect('/dashboard');
        }
    },

    // GET /agencies/create
    createView: (req, res) => {
        res.render('agencies/config', { 
            title: 'Configure Agency', 
            activePage: 'agencies',
            layout: 'layouts/dashboard_layout' 
        });
    },

    // POST /agencies
    store: async (req, res) => {
        try {
            const { agencyId, agencyName, googleAdsCustomerId } = req.body;
            
            const newAgency = new Agency({
                agencyId,
                agencyName,
                googleAdsCustomerId
            });

            await newAgency.save();
            req.flash('success', 'Agency configured successfully');
            res.redirect('/agencies');
        } catch (error) {
            console.error('Error saving agency:', error);
            req.flash('error', error.message || 'Error saving agency');
            res.redirect('/agencies/create');
        }
    }
};

module.exports = agencyController;
