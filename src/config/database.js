const mongoose = require('mongoose');
const logger = require('../utils/logger');

const connectDB = async () => {
    const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/ghl-google-ads';
    try {
        await mongoose.connect(uri);
        logger.info(`[Database] MongoDB connected successfully to ${uri}`);
    } catch (error) {
        logger.error(`[Database Error] Connection failed: ${error.message}`);
        process.exit(1);
    }
};

module.exports = connectDB;
