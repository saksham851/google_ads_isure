const mongoose = require('mongoose');

const leadSchema = new mongoose.Schema({
    ghlContactId: { type: String, required: true, unique: true },
    name: { type: String },
    email: { type: String },
    phone: { type: String },

    // Tracking
    gclid: { type: String },
    utm_source: { type: String },
    utm_campaign: { type: String },
    utm_medium: { type: String },

    // Relations
    agencyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Agency' },
    locationId: { type: String },
    campaignId: { type: mongoose.Schema.Types.ObjectId, ref: 'Campaign' },

    pipelineStage: { type: String },
    conversionValue: { type: Number, default: 0 },
    isConverted: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model('Lead', leadSchema);
