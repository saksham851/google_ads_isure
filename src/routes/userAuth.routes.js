const express = require('express');
const router = express.Router();
const userAuth = require('../controllers/userAuth.controller');

// Login
router.get('/login', userAuth.loginView);
router.post('/login', userAuth.login);

// Logout
router.get('/logout', userAuth.logout);

// Forgot Password
router.get('/forgot-password', userAuth.forgotPasswordView);
router.post('/forgot-password', userAuth.forgotPassword);

// Reset Password
router.get('/reset-password/:token', userAuth.resetPasswordView);
router.post('/reset-password/:token', userAuth.resetPassword);

module.exports = router;
