const isAuthenticated = (req, res, next) => {
    // 1. Check if user is already authenticated (including auto-logged GHL users)
    if (req.session && req.session.user) {
        // If a new locationId is detected in the current request (e.g. from query/referer)
        // ensure it matches the session context if it's not a superadmin.
        const queryId = req.query.location_id || req.query.locationId;
        if (queryId && req.session.user.role !== 'superadmin' && !req.session.user.locationIds.includes(queryId)) {
            req.session.user.locationIds = [queryId];
            req.session.activeLocationId = queryId;
        }
        return next();
    }

    // 2. IMPORTANT: If it's an AJAX/JSON request (used by buttons), return 401 instead of redirecting
    // This prevents buttons from doing nothing when the session expires inside GHL iframes
    const isAjax = req.xhr || 
                  (req.headers.accept && req.headers.accept.includes('json')) ||
                  (req.headers['content-type'] && req.headers['content-type'].includes('json'));

    if (isAjax) {
        return res.status(401).json({ 
            success: false, 
            error: 'Session expired. Please refresh the page to login again.' 
        });
    }

    // 3. Normal page request: Store original URL and redirect to login
    // Note: GHL users should have already been auto-logged by the global middleware in server.js
    if (req.originalUrl && !req.originalUrl.includes('/superadmin/login')) {
        req.session.returnTo = req.originalUrl;
    }
    
    res.redirect('/superadmin/login');
};

const isSuperadmin = (req, res, next) => {
    if (req.session && req.session.user && req.session.user.role === 'superadmin') {
        return next();
    }
    req.flash('error', 'Access denied. Superadmin privileges required.');
    res.redirect('/dashboard');
};

const isUser = (req, res, next) => {
    if (req.session && req.session.user && (req.session.user.role === 'user' || req.session.user.role === 'superadmin')) {
        return next();
    }
    req.flash('error', 'Access denied.');
    res.redirect('/superadmin/login');
};

module.exports = { isAuthenticated, isSuperadmin, isUser };
