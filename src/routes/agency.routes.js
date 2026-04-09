const express    = require('express');
const router     = express.Router();
const ctrl       = require('../controllers/agency.controller');
const { isAuthenticated } = require('../middlewares/auth.middleware');

router.get('/launchpad', ctrl.ghlExtension);
router.use(isAuthenticated);

router.get('/',                         ctrl.index);
router.get('/create',                   ctrl.createView);
router.post('/',                        ctrl.store);
router.get('/:locationId/detail',       ctrl.detail);
router.get('/:locationId/settings',     ctrl.settingsView);
router.post('/:locationId/disconnect-ghl', ctrl.disconnectGHL);
router.delete('/:locationId',           ctrl.deleteAgency);
router.post('/:locationId/webhooks',    ctrl.addWebhook);
router.delete('/:locationId/webhooks/:slug', ctrl.removeWebhook);
router.put('/:locationId/webhooks/:slug/mapping', ctrl.updateWebhookMapping);

module.exports = router;
