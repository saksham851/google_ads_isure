const mongoose = require('mongoose');

const campaignSchema = new mongoose.Schema({
    campaignName: { type: String, required: true },
    serviceType: { type: String },
    locationId: { type: String }, // GHL location this campaign belongs to
    agencyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Agency', required: true },

    status: { type: String, enum: ['active', 'paused', 'archived'], default: 'active' },

    // Tracking mapping
    googleAdsConversionActionId: { type: String }, // Mapped Conversion Action ID in Google Ads
}, { timestamps: true });

module.exports = mongoose.model('Campaign', campaignSchema);
