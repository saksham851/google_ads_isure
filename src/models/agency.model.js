const mongoose = require('mongoose');

const agencySchema = new mongoose.Schema({
    agencyId: { type: String, required: true, unique: true }, // GHL Company/Agency ID
    locationId: { type: String, unique: true, sparse: true }, // GHL Location ID if installed per location
    agencyName: { type: String },
    email: { type: String },
    phone: { type: String },

    // GHL OAuth Tokens
    ghlAccessToken: { type: String },
    ghlRefreshToken: { type: String },
    ghlTokenExpiry: { type: Date },

    // Google Ads integration per agency (optional if they use their own account)
    googleAdsCustomerId: { type: String },
    googleRefreshToken: { type: String },
    googleAccessToken: { type: String },

    activeCampaigns: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Campaign' }],
    isActive: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('Agency', agencySchema);
