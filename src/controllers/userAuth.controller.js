const User = require('../models/User');
const crypto = require('crypto');
const { sendEmail } = require('../utils/mail.util');

const userAuthController = {
    // GET /login
    loginView: (req, res) => {
        const locationId = req.query.locationId || req.query.location_id;
        if (req.session.user) return res.redirect(`/dashboard${locationId ? '?locationId=' + locationId : ''}`);
        res.render('auth/login', { 
            title: 'Login',
            locationId: locationId
        });
    },

    // POST /login
    login: async (req, res) => {
        try {
            const { email, password } = req.body;
            console.log(`[Auth] Attempting login for: ${email}`);
            
            const user = await User.findOne({ email });

            if (!user || !(await user.comparePassword(password))) {
                console.log(`[Auth] Failed login for: ${email}`);
                req.flash('error', 'Invalid email or password');
                return res.redirect('/user/login');
            }

            req.session.user = {
                id: user._id,
                email: user.email,
                role: user.role,
                agencyId: user.agencyId,
                locationIds: user.locationIds || []
            };

            const locationId = req.body.locationId;
            const redirectUrl = req.session.returnTo || `/dashboard${locationId ? '?locationId=' + locationId : ''}`;
            delete req.session.returnTo;
            
            console.log(`[Auth] Successful login: ${email}. Redirecting to: ${redirectUrl}`);
            res.redirect(redirectUrl);
        } catch (error) {
            console.error('[Auth] Login error:', error);
            const locationId = req.body.locationId;
            req.flash('error', 'Something went wrong');
            res.redirect(`/user/login${locationId ? '?locationId=' + locationId : ''}`);
        }
    },

    // GET /logout
    logout: (req, res) => {
        const locationId = req.session.activeLocationId || (req.session.user && req.session.user.locationId);
        req.session.destroy((err) => {
            if (err) console.error('[Auth] Logout session error:', err);
            res.redirect(`/user/login${locationId ? '?locationId=' + locationId : ''}`);
        });
    },

    // GET /forgot-password
    forgotPasswordView: (req, res) => {
        res.render('auth/forgot-password', { title: 'Forgot Password' });
    },

    // POST /forgot-password
    forgotPassword: async (req, res) => {
        try {
            const { email } = req.body;
            console.log('--- Forgot Password Request ---');
            console.log('Email:', email);
            console.log('MAIL_HOST:', process.env.MAIL_HOST);
            console.log('MAIL_PORT:', process.env.MAIL_PORT);
            console.log('MAIL_USERNAME:', process.env.MAIL_USERNAME);

            const user = await User.findOne({ email });

            if (!user) {
                console.log('User not found in DB');
                req.flash('success', 'If an account exists with that email, a reset link has been sent.');
                return res.redirect('/user/forgot-password');
            }

            // Create reset token
            const token = crypto.randomBytes(32).toString('hex');
            user.resetToken = token;
            user.resetTokenExpiry = Date.now() + 3600000; // 1 hour
            await user.save();
            console.log('Reset token generated and saved');

            // Send email
            const resetUrl = `${req.protocol}://${req.get('host')}/reset-password/${token}`;
            const template = `
                <h2>Password Reset Request</h2>
                <p>Hello,</p>
                <p>You requested a password reset. Click the link below to set a new password:</p>
                <p><a href="${resetUrl}">${resetUrl}</a></p>
                <p>This link will expire in 1 hour.</p>
                <p>If you did not request this, please ignore this email.</p>
            `;

            await sendEmail({
                to: email,
                subject: 'Password Reset Request',
                html: template
            });

            console.log('Email sent successfully!');
            req.flash('success', 'A reset link has been sent to your email.');
            res.redirect('/user/forgot-password');
        } catch (error) {
            console.error('--- Forgot Password Error ---');
            console.error(error);
            req.flash('error', 'Something went wrong while sending the email.');
            res.redirect('/user/forgot-password');
        }
    },

    // GET /reset-password/:token
    resetPasswordView: async (req, res) => {
        const { token } = req.params;
        const user = await User.findOne({
            resetToken: token,
            resetTokenExpiry: { $gt: Date.now() }
        });

        if (!user) {
            req.flash('error', 'Token is invalid or has expired');
            return res.redirect('/user/forgot-password');
        }

        res.render('auth/reset-password', { token, searchTitle: 'Reset Password' });
    },

    // POST /reset-password/:token
    resetPassword: async (req, res) => {
        try {
            const { token } = req.params;
            const { password, confirmPassword } = req.body;

            if (password !== confirmPassword) {
                req.flash('error', 'Passwords do not match');
                return res.redirect(`/user/reset-password/${token}`);
            }

            const user = await User.findOne({
                resetToken: token,
                resetTokenExpiry: { $gt: Date.now() }
            });

            if (!user) {
                req.flash('error', 'Token is invalid or has expired');
                return res.redirect('/user/forgot-password');
            }

            user.password = password;
            user.resetToken = undefined;
            user.resetTokenExpiry = undefined;
            await user.save();

            req.flash('success', 'Password reset successful! You can now login.');
            res.redirect('/user/login');
        } catch (error) {
            console.error('Reset password error:', error);
            req.flash('error', 'Something went wrong');
            res.redirect('/user/forgot-password');
        }
    }
};

module.exports = userAuthController;
