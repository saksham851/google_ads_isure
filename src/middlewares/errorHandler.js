const logger = require('../utils/logger');

const errorHandler = (err, req, res, next) => {
    logger.error(err.message, { stack: err.stack, method: req.method, url: req.originalUrl });

    res.status(err.status || 500).json({
        success: false,
        error: err.message || 'Server Error',
    });
};

module.exports = errorHandler;
