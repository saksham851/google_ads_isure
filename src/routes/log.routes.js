const express = require('express');
const router = express.Router();
const logController = require('../controllers/log.controller');

const { isAuthenticated } = require('../middlewares/auth.middleware');

router.use(isAuthenticated);

router.get('/logs', logController.index);
router.get('/webhooks-logs', logController.webhookLogs);

module.exports = router;
