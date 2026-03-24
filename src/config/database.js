const mongoose = require('mongoose');
const logger = require('../utils/logger');

let cached = global.mongoose;

if (!cached) {
    cached = global.mongoose = { conn: null, promise: null };
}

const connectDB = async () => {
    const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/ghl-google-ads';
    
    if (cached.conn) {
        return cached.conn;
    }

    if (!cached.promise) {
        const opts = {
            bufferCommands: false,
        };

        cached.promise = mongoose.connect(uri, opts).then((mongoose) => {
            logger.info(`[Database] MongoDB connected successfully to ${uri}`);
            return mongoose;
        }).catch(error => {
            logger.error(`[Database Error] Connection failed: ${error.message}`);
            cached.promise = null;
            throw error;
        });
    }

    try {
        cached.conn = await cached.promise;
    } catch (error) {
        cached.promise = null;
        throw error;
    }
    
    return cached.conn;
};

module.exports = connectDB;
