const express = require('express');
const router = express.Router();
const userController = require('../controllers/user.controller');
const { isAuthenticated } = require('../middlewares/auth.middleware');

// All user management routes require superadmin role
const isAdmin = (req, res, next) => {
    if (req.session.user && req.session.user.role === 'superadmin') {
        return next();
    }
    res.redirect('/dashboard');
};

router.use(isAuthenticated);
router.use(isAdmin);

router.get('/', userController.index);
router.get('/:id', userController.show);

module.exports = router;
