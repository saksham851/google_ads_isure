const winston = require('winston');

const transports = [
    new winston.transports.Console({
        format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
        )
    })
];

// Only write to files if we are NOT in Vercel (Vercel filesystem is read-only)
if (!process.env.VERCEL) {
    transports.push(
        new winston.transports.File({
            filename: 'logs/error.log',
            level: 'error',
            format: winston.format.json()
        }),
        new winston.transports.File({
            filename: 'logs/combined.log',
            format: winston.format.json()
        })
    );
}

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
    transports: transports
});

module.exports = logger;
