const mongoose = require('mongoose');

const conversionLogSchema = new mongoose.Schema({
    leadId: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead' },
    gclid: { type: String, required: true },
    conversionTime: { type: String, required: true }, // Format: yyyy-mm-dd hh:mm:ss+|-hh:mm
    conversionValue: { type: Number },
    conversionAction: { type: String }, // e.g. "Purchased" or identifier

    status: { type: String, enum: ['success', 'failed', 'retrying'], default: 'success' },
    googleAdsResponse: { type: mongoose.Schema.Types.Mixed }, // Full response from GAds
    errorMessage: { type: String },
    retryCount: { type: Number, default: 0 }
}, { timestamps: true });

module.exports = mongoose.model('ConversionLog', conversionLogSchema);
