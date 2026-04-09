const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const dotenv = require('dotenv');
const path = require('path');
const session = require('express-session');
const ms = require('connect-mongo');
const MongoStore = ms.default || ms;
const flash = require('connect-flash');
const expressLayouts = require('express-ejs-layouts');

dotenv.config();

// ── Route imports ─────────────────────────────────────────────────────────────
const authRoutes = require('./routes/auth.routes');
const userAuthRoutes = require('./routes/userAuth.routes');
const agencyRoutes = require('./routes/agency.routes');
const logRoutes = require('./routes/log.routes');
const webhookRoutes = require('./routes/webhook.routes');
const googleAdsRoutes = require('./routes/googleAds.routes');
const adminUserRoutes = require('./routes/admin.user.routes');

// ── Controller / Middleware imports ───────────────────────────────────────────
const dashboardController = require('./controllers/dashboard.controller');
const errorHandler = require('./middlewares/errorHandler');
const { isAuthenticated } = require('./middlewares/auth.middleware');
const connectDB = require('./config/database');
const logger = require('./utils/logger');

const app = express();

// ── View Engine ───────────────────────────────────────────────────────────────
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(expressLayouts);
app.set('layout', 'layouts/auth_layout');

// ── Session ───────────────────────────────────────────────────────────────────
const store = MongoStore.create({
    mongoUrl: process.env.MONGODB_URI,
    collectionName: 'sessions'
});

// Trust proxy for secure cookies (mandatory on Vercel/proxies)
app.set('trust proxy', 1);

const isProduction = process.env.NODE_ENV === 'production' || (process.env.BASE_URL && !process.env.BASE_URL.includes('localhost'));

// Support for GHL Iframes: ensure cookies work across domains
const cookieSettings = {
    maxAge: 1000 * 60 * 60 * 24, // 1 day
    secure: isProduction,         // Must be true in production/HTTPS
    sameSite: isProduction ? 'none' : 'lax' // 'none' is required for iframes
};

// If we are on HTTPS but not explicitly in "production" mode, 
// we still need sameSite: none for iframes to work (e.g. ngrok/live dev)
if (process.env.BASE_URL && process.env.BASE_URL.startsWith('https://')) {
    cookieSettings.secure = true;
    cookieSettings.sameSite = 'none';
}

app.use(session({
    secret: process.env.SESSION_SECRET || 'secret-key-google-ads',
    resave: true,
    saveUninitialized: false,
    store,
    proxy: true,
    cookie: cookieSettings
}));

app.use(flash());

app.use((req, res, next) => {
    // Detect from Query
    let queryLocationId = req.query.location_id || req.query.locationId;
    
    // Detect from Referer (Parent GHL Page)
    let refererLocationId = null;
    const referer = req.headers.referer || '';
    if (referer) {
        // Broaden regex to find any alphanumeric string following /location/ or in locationId= or location_id=
        const match = referer.match(/location\/([a-zA-Z0-9_-]+)/i) || 
                      referer.match(/locationId=([a-zA-Z0-9_-]+)/i) || 
                      referer.match(/location_id=([a-zA-Z0-9_-]+)/i);
        if (match && match[1]) {
            refererLocationId = match[1];
        }
    }

    const detectedId = queryLocationId || refererLocationId;
    
    if (detectedId) {
        // Update session immediately if context switch detected
        req.session.activeLocationId = detectedId;
        req.query.locationId = detectedId; // Normalization

        // ── GHL SECURITY ISOLATION ────────────────────────────────────
        // Whenever we are in GHL context (detectedId present), we enforce 
        // ghl_user role UNLESS a Superadmin is already logged in. 
        // This ensures GHL users are auto-logged in without a form, 
        // while Superadmins can keep their session if they navigate here.
        const shouldEnforceGhlSession = !req.session.user || (req.session.user.role === 'ghl_user' && !req.session.user.locationIds.includes(detectedId));

        if (shouldEnforceGhlSession && (!req.session.user || req.session.user.role !== 'superadmin')) {
            req.session.user = {
                email: 'ghl_user@isuremedia.com', 
                locationIds: [detectedId],
                role: 'ghl_user',
                isGhlEmbedded: true
            };
            logger.info(`[GHL Security] Enforced isolation for location: ${detectedId}`);
        }
    } else {
        // ── OUTSIDE GHL CONTEXT ────────────────────────────────────────
        // If we are NOT in GHL but have a ghl_user session, clear it.
        // This ensures sub-account users can't access the app outside GHL 
        // and keeps the login screen available for superadmins.
        if (req.session.user && req.session.user.role === 'ghl_user') {
            req.session.user = null;
            req.session.activeLocationId = null;
            logger.info(`[GHL Auth] Cleared ghl_user session - accessed outside of iframe.`);
        }
    }

    next();
});

// ── Global view locals ────────────────────────────────────────────────────────
app.use((req, res, next) => {
    res.locals.error = req.flash('error');
    res.locals.success = req.flash('success');
    res.locals.user = req.session.user || null;
    res.locals.activeLocationId = req.session.activeLocationId || null;
    res.locals.isGhlEmbedded = req.session.user?.isGhlEmbedded || false;
    res.locals.activePage = '';
    res.locals.baseUrl = process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;
    next();
});

// ── Security & Parsing ────────────────────────────────────────────────────────
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
            scriptSrcAttr: ["'self'", "'unsafe-inline'", "'unsafe-hashes'"], // Stronger allowance for onclick
            styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", "https://fonts.googleapis.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdn.jsdelivr.net"],
            imgSrc: ["'self'", "data:", "https://*"],
            frameAncestors: ["'self'", "https://*.gohighlevel.com", "https://*.leadconnectorhq.com", "https://*.leadconnector.com", "https://*.msgsndr.com", "https://*.salesley.com"]
        }
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: false,
    frameguard: false
}));
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// ── Static assets ─────────────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, 'public')));

// ── Routes ────────────────────────────────────────────────────────────────────
// Public OAuth routes & Webhooks (no auth required)
app.use('/auth', authRoutes);
app.use('/webhooks', webhookRoutes);

// Authenticated app routes
app.use('/user', userAuthRoutes);
app.use('/agencies', agencyRoutes);
app.use('/users', adminUserRoutes);
app.use('/', logRoutes);

// Google Ads JSON API (for frontend dropdowns)
app.use('/google-ads', googleAdsRoutes);

// ── Dashboard & Root ──────────────────────────────────────────────────────────
app.get('/', (req, res) => {
    if (req.session.user) return res.redirect('/dashboard');
    res.redirect('/user/login');
});

app.get('/dashboard', isAuthenticated, dashboardController.index);

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/health', (req, res) => res.status(200).json({ status: 'ok' }));

// ── 404 handler ───────────────────────────────────────────────────────────────
app.use((req, res, next) => {
    const error = new Error('Not Found');
    error.status = 404;
    next(error);
});

app.use(errorHandler);

// ── Database connection ───────────────────────────────────────────────────────
connectDB().then(() => {
    // Start the automated token refresh service once DB is connected
    const tokenRefreshService = require('./services/tokenRefresh.service');
    tokenRefreshService.start();
}).catch(err => {
    logger.error('[DB] Failed to connect to MongoDB:', err);
});

// ── Start server locally ──────────────────────────────────────────────────────
if (require.main === module) {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
        logger.info(`[Server] Running on http://localhost:${PORT}`);
        logger.info(`[Auth]   GHL Install:      http://localhost:${PORT}/auth/install`);
        logger.info(`[Auth]   Google Login:     http://localhost:${PORT}/auth/google-login?locationId=<locationId>`);
        logger.info(`[Hook]   GHL Webhook:      http://localhost:${PORT}/webhooks/ghl`);
        logger.info(`[API]    Manager Accounts: http://localhost:${PORT}/google-ads/manager-accounts`);
    });
}

module.exports = app;
