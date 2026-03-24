const express = require('express');
const router = express.Router();
const logController = require('../controllers/log.controller');

// Check authentication middleware
const isAuthenticated = (req, res, next) => {
    if (req.session.user) return next();
    res.redirect('/user/login');
};

router.use(isAuthenticated);

router.get('/logs', logController.index);
router.get('/webhooks-logs', logController.webhookLogs);

module.exports = router;
