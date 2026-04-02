const isAuthenticated = (req, res, next) => {
    if (req.session && req.session.user) return next();
    
    // Store original URL if it's not a logout or login page
    if (req.originalUrl && !req.originalUrl.includes('/user/login')) {
        req.session.returnTo = req.originalUrl;
    }
    
    res.redirect('/user/login');
};

module.exports = { isAuthenticated };
