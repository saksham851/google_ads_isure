const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const dotenv = require('dotenv');
const path = require('path');
const session = require('express-session');
const MongoDBStore = require('connect-mongodb-session')(session);
const flash = require('connect-flash');
const expressLayouts = require('express-ejs-layouts');

dotenv.config();

const authRoutes = require('./routes/auth.routes');
const userAuthRoutes = require('./routes/userAuth.routes');
const agencyRoutes = require('./routes/agency.routes');
const logRoutes = require('./routes/log.routes');
const webhookRoutes = require('./routes/webhook.routes');
const dashboardController = require('./controllers/dashboard.controller');
const errorHandler = require('./middlewares/errorHandler');
const connectDB = require('./config/database');
const logger = require('./utils/logger');

const app = express();

// View Engine Setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(expressLayouts);
app.set('layout', 'layouts/auth_layout'); // Default layout

// Session Setup
const store = new MongoDBStore({
    uri: process.env.MONGODB_URI,
    collection: 'sessions'
});

app.use(session({
    secret: process.env.SESSION_SECRET || 'secret-key-google-ads',
    resave: false,
    saveUninitialized: false,
    store: store,
    cookie: {
        maxAge: 1000 * 60 * 60 * 24 // 1 day
    }
}));

app.use(flash());

// Authentication Middleware
const isAuthenticated = (req, res, next) => {
    if (req.session.user) return next();
    res.redirect('/user/login');
};

// Helper middlewares for views
app.use((req, res, next) => {
    res.locals.error = req.flash('error');
    res.locals.success = req.flash('success');
    res.locals.user = req.session.user || null;
    res.locals.activePage = ''; // default
    res.locals.baseUrl = `${req.protocol}://${req.get('host')}`;
    next();
});

app.use(helmet({
    contentSecurityPolicy: false, // Disable CSP for now as it may block CDNs/assets
}));
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// Routes
app.use('/auth', authRoutes);
app.use('/user', userAuthRoutes);
app.use('/agencies', agencyRoutes);
app.use('/', logRoutes);
app.use('/webhooks', webhookRoutes);

// Root Redirect to Dashboard or Login
app.get('/', (req, res) => {
    if (req.session.user) return res.redirect('/dashboard');
    res.redirect('/user/login');
});

// Dashboard
app.get('/dashboard', isAuthenticated, dashboardController.index);

app.get('/health', (req, res) => res.status(200).json({ status: 'ok' }));


app.use((req, res, next) => {
    const error = new Error('Not Found');
    error.status = 404;
    next(error);
});

app.use(errorHandler);
const startServer = async () => {
    // Connect to the DB first
    await connectDB();
    const PORT = process.env.PORT || 3000;

    app.listen(PORT, () => {
        logger.info(`[Server] GHL-Google Ads Integration Backend running on port ${PORT}`);
        logger.info(`[Auth] User Login: http://localhost:${PORT}/user/login`);
        logger.info(`[Webhooks] GHL Webhook endpoint: http://localhost:${PORT}/webhooks/ghl`);
    });
};

startServer().catch(err => {
    logger.error('Failed to start server:', err);
    process.exit(1);
});

