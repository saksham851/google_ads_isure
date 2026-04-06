const isAuthenticated = (req, res, next) => {
    // Detect from Query
    let queryLocationId = req.query.location_id || req.query.locationId;
    
    // Detect from Referer (Parent GHL Page)
    let refererLocationId = null;
    const referer = req.headers.referer || '';
    if (referer) {
        // Broaden regex to find any 10+ char alphanumeric string following /location/ or /locationId/
        const match = referer.match(/location[Id]*\/([a-zA-Z0-9]+)/i);
        if (match && match[1]) {
            refererLocationId = match[1];
        }
    }

    // Determine target: Query wins, then Referer
    let detectedId = queryLocationId || refererLocationId;

    if (detectedId) {
        // If detected ID is different from session, switch context
        if (req.session.activeLocationId !== detectedId) {
            req.session.activeLocationId = detectedId;
            req.query.locationId = detectedId; 
        } else {
            req.query.locationId = detectedId;
        }
    } else if (req.session.activeLocationId) {
        // Fallback to session
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
