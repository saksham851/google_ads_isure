const express        = require('express');
const cors           = require('cors');
const helmet         = require('helmet');
const morgan         = require('morgan');
const dotenv         = require('dotenv');
const path           = require('path');
const session        = require('express-session');
const ms             = require('connect-mongo');
const MongoStore     = ms.default || ms;
const flash          = require('connect-flash');
const expressLayouts = require('express-ejs-layouts');

dotenv.config();

// ── Route imports ─────────────────────────────────────────────────────────────
const authRoutes        = require('./routes/auth.routes');
const userAuthRoutes    = require('./routes/userAuth.routes');
const agencyRoutes      = require('./routes/agency.routes');
const logRoutes         = require('./routes/log.routes');
const webhookRoutes     = require('./routes/webhook.routes');
const googleAdsRoutes   = require('./routes/googleAds.routes');

// ── Controller / Middleware imports ───────────────────────────────────────────
const dashboardController = require('./controllers/dashboard.controller');
const errorHandler        = require('./middlewares/errorHandler');
const { isAuthenticated } = require('./middlewares/auth.middleware');
const connectDB           = require('./config/database');
const logger              = require('./utils/logger');

const app = express();

// ── View Engine ───────────────────────────────────────────────────────────────
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(expressLayouts);
app.set('layout', 'layouts/auth_layout');

// ── Session ───────────────────────────────────────────────────────────────────
const store = MongoStore.create({
    mongoUrl:       process.env.MONGODB_URI,
    collectionName: 'sessions'
});

app.use(session({
    secret:            process.env.SESSION_SECRET || 'secret-key-google-ads',
    resave:            false,
    saveUninitialized: false,
    store,
    cookie: { maxAge: 1000 * 60 * 60 * 24 } // 1 day
}));

app.use(flash());

// ── Global view locals ────────────────────────────────────────────────────────
app.use((req, res, next) => {
    res.locals.error    = req.flash('error');
    res.locals.success  = req.flash('success');
    res.locals.user     = req.session.user || null;
    res.locals.activePage = '';
    res.locals.baseUrl  = process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;
    next();
});

// ── Security & Parsing ────────────────────────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// ── Static assets ─────────────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, 'public')));

// ── Routes ────────────────────────────────────────────────────────────────────
// Public OAuth routes & Webhooks (no auth required)
app.use('/auth',     authRoutes);
app.use('/webhooks', webhookRoutes);

// Authenticated app routes
app.use('/user',     userAuthRoutes);
app.use('/agencies', agencyRoutes);
app.use('/',         logRoutes);

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
