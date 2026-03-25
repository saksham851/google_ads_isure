/**
 * Shared authentication middleware.
 * Import this in any route file instead of re-declaring.
 */
const isAuthenticated = (req, res, next) => {
    if (req.session && req.session.user) return next();
    res.redirect('/user/login');
};

module.exports = { isAuthenticated };
