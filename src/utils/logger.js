const winston = require('winston');

const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp({
            format: 'YYYY-MM-DD HH:mm:ss'
        }),
        winston.format.errors({ stack: true }),
        winston.format.splat()
    ),
    defaultMeta: { service: 'ghl-gads-backend' },
    transports: [
        new winston.transports.File({
            filename: 'logs/error.log',
            level: 'error',
            format: winston.format.json()
        }),
        new winston.transports.File({
            filename: 'logs/combined.log',
            format: winston.format.json()
        })
    ]
});

// If we're not in production then log to the `console` with a clean format
if (process.env.NODE_ENV !== 'production') {
    logger.add(new winston.transports.Console({
        format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
        )
    }));
}

module.exports = logger;
