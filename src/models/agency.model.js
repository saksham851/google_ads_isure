const mongoose = require('mongoose');
const { encrypt, decrypt } = require('../utils/crypto.util');

const conversionMappingSchema = new mongoose.Schema({
    pipelineStageKeyword: { type: String }, // e.g. "purchased", "closed won"
    conversionActionId:   { type: String, set: encrypt, get: decrypt }, // Google Ads Conversion Action ID
    conversionActionName: { type: String }, // Human-readable name for display
    conversionValue:      { type: Number, default: 0 }
}, { _id: false, toObject: { getters: true }, toJSON: { getters: true } });

const agencySchema = new mongoose.Schema({
    agencyId:   { type: String, required: true }, // GHL Company/Agency ID
    locationId: { type: String, required: true, unique: true },   // GHL Location ID (sub-account)
    companyName: { type: String }, // Parent Agency Name
    subAccountName: { type: String }, // Individual Sub-account Name
    agencyName: { type: String }, // Deprecated field, maintain for compatibility if needed
    email:      { type: String },
    phone:      { type: String },

    // ── GHL OAuth Tokens ────────────────────────────────────────────
    ghlAccessToken:  { type: String, set: encrypt, get: decrypt },
    ghlRefreshToken: { type: String, set: encrypt, get: decrypt },
    ghlTokenExpiry:  { type: Date },

    // ── Google Ads OAuth Tokens ─────────────────────────────────────
    googleAccessToken:  { type: String, set: encrypt, get: decrypt },
    googleRefreshToken: { type: String, set: encrypt, get: decrypt },
    googleTokenExpiry:  { type: Date },

    // BYOC (Bring Your Own Credentials) for Google Ads
    customGoogleAdsClientId:       { type: String, set: encrypt, get: decrypt },
    customGoogleAdsClientSecret:   { type: String, set: encrypt, get: decrypt },
    customGoogleAdsDeveloperToken: { type: String, set: encrypt, get: decrypt },

    // ── Google Ads Account Selection ────────────────────────────────
    // The MCC (Manager) account the user selected
    googleMccId:          { type: String, set: encrypt, get: decrypt }, // e.g. "1234567890"
    googleMccName:        { type: String },

    // The client (sub) account under the MCC
    googleAdsCustomerId:  { type: String, set: encrypt, get: decrypt }, // e.g. "9876543210"
    googleAdsAccountName: { type: String },

    // ── Conversion Action Mappings ──────────────────────────────────
    // Maps pipeline stage keywords → conversion actions
    conversionMappings: [conversionMappingSchema],

    // ── Custom Webhook Endpoints ────────────────────────────────────
    // Each entry gives the sub-account its own slug: /webhooks/ghl/:locationId/:slug
    customWebhooks: [{
        name:      { type: String, required: true }, // e.g. "Lead Form Submission"
        slug:      { type: String, required: true }, // e.g. "lead-form-submission"
        createdAt: { type: Date, default: Date.now }
    }],

    activeCampaigns: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Campaign' }],
    isActive: { type: Boolean, default: true }
}, { 
    timestamps: true,
    toObject: { getters: true },
    toJSON: { getters: true }
});

module.exports = mongoose.model('Agency', agencySchema);
