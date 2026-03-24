const express = require('express');
const router = express.Router();
const agencyController = require('../controllers/agency.controller');

// Check authentication middleware
const isAuthenticated = (req, res, next) => {
    if (req.session.user) return next();
    res.redirect('/user/login');
};

router.use(isAuthenticated);

router.get('/', agencyController.index);
router.get('/create', agencyController.createView);
router.post('/', agencyController.store);

module.exports = router;
