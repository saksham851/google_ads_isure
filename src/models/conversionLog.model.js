const mongoose = require('mongoose');

const conversionLogSchema = new mongoose.Schema({
    agencyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Agency' },
    leadId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Lead' },
    gclid:    { type: String, required: true },
    conversionTime:   { type: String, required: true }, // yyyy-mm-dd hh:mm:ss+|-hh:mm
    conversionValue:  { type: Number },
    conversionAction: { type: String }, // Conversion Action ID

    status: {
        type: String,
        enum: ['pending', 'success', 'failed', 'retrying'],
        default: 'pending'
    },
    googleAdsResponse: { type: mongoose.Schema.Types.Mixed },
    errorMessage:      { type: String },
    retryCount:        { type: Number, default: 0 }
}, { timestamps: true });

module.exports = mongoose.model('ConversionLog', conversionLogSchema);
