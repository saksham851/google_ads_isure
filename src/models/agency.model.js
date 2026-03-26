const mongoose = require('mongoose');

const conversionMappingSchema = new mongoose.Schema({
    pipelineStageKeyword: { type: String }, // e.g. "purchased", "closed won"
    conversionActionId:   { type: String }, // Google Ads Conversion Action ID
    conversionActionName: { type: String }, // Human-readable name for display
    conversionValue:      { type: Number, default: 0 }
}, { _id: false });

const agencySchema = new mongoose.Schema({
    agencyId:   { type: String, required: true }, // GHL Company/Agency ID
    locationId: { type: String, required: true, unique: true },   // GHL Location ID (sub-account)
    agencyName: { type: String },
    email:      { type: String },
    phone:      { type: String },

    // ── GHL OAuth Tokens ────────────────────────────────────────────
    ghlAccessToken:  { type: String },
    ghlRefreshToken: { type: String },
    ghlTokenExpiry:  { type: Date },

    // ── Google Ads OAuth Tokens ─────────────────────────────────────
    googleAccessToken:  { type: String },
    googleRefreshToken: { type: String },
    googleTokenExpiry:  { type: Date },

    // BYOC (Bring Your Own Credentials) for Google Ads
    customGoogleAdsClientId:       { type: String },
    customGoogleAdsClientSecret:   { type: String },
    customGoogleAdsDeveloperToken: { type: String },

    // ── Google Ads Account Selection ────────────────────────────────
    // The MCC (Manager) account the user selected
    googleMccId:          { type: String }, // e.g. "1234567890"
    googleMccName:        { type: String },

    // The client (sub) account under the MCC
    googleAdsCustomerId:  { type: String }, // e.g. "9876543210"
    googleAdsAccountName: { type: String },

    // ── Conversion Action Mappings ──────────────────────────────────
    // Maps pipeline stage keywords → conversion actions
    conversionMappings: [conversionMappingSchema],

    activeCampaigns: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Campaign' }],
    isActive: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('Agency', agencySchema);
