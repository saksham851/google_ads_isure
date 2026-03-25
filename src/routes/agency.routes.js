const express    = require('express');
const router     = express.Router();
const ctrl       = require('../controllers/agency.controller');
const { isAuthenticated } = require('../middlewares/auth.middleware');

router.use(isAuthenticated);

router.get('/',                         ctrl.index);
router.get('/create',                   ctrl.createView);
router.post('/',                        ctrl.store);
router.get('/:locationId/detail',       ctrl.detail);
router.post('/:locationId/disconnect-ghl', ctrl.disconnectGHL);
router.delete('/:locationId',           ctrl.deleteAgency);

module.exports = router;
