const isAuthenticated = (req, res, next) => {
    // 0. Capture locationId from GHL if present in query or referer
    let queryLocationId = req.query.location_id || req.query.locationId;
    let refererLocationId = null;

    // Extract from Referer header (GHL uses /location/ID/ in its URLs)
    if (req.headers.referer) {
        const match = req.headers.referer.match(/location\/([a-zA-Z0-9]{10,})/);
        if (match) refererLocationId = match[1];
    }

    // Determine target locationId: Prioritize Query > Referer > Session
    let targetLocationId = queryLocationId || refererLocationId;

    if (targetLocationId) {
        // Switch session if we found a new locationId in query or referer
        req.session.activeLocationId = targetLocationId;
        req.query.locationId = targetLocationId;
    } else if (req.session.activeLocationId) {
        // Keep existing session if no new context found
        req.query.locationId = req.session.activeLocationId;
    }

    // 1. Check if user is authenticated
    if (req.session && req.session.user) return next();
    
    // 2. IMPORTANT: If it's an AJAX/JSON request (used by buttons), return 401 instead of redirecting
    // This prevents buttons from doing nothing when the session expires inside GHL iframes
    const isAjax = req.xhr || (req.headers.accept && req.headers.accept.includes('json'));
    if (isAjax) {
        return res.status(401).json({ 
            success: false, 
            error: 'Session expired. Please refresh the page to login again.' 
        });
    }

    // 3. Normal page request: Store original URL and redirect to login
    if (req.originalUrl && !req.originalUrl.includes('/user/login')) {
        req.session.returnTo = req.originalUrl;
    }
    
    res.redirect('/user/login');
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
    res.redirect('/user/login');
};

module.exports = { isAuthenticated, isSuperadmin, isUser };
