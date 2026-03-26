const mongoose = require('mongoose');

const webhookLogSchema = new mongoose.Schema({
    source:      { type: String, default: 'GHL' },
    locationId:  { type: String, index: true },        // sub-account location id
    eventType:   { type: String, default: 'general' }, // e.g. lead-created, stage-changed
    payload:     { type: mongoose.Schema.Types.Mixed },
    headers:     { type: mongoose.Schema.Types.Mixed },
    status:      { type: String, enum: ['success', 'error', 'pending'], default: 'pending' },
    errorMessage:{ type: String }
}, { timestamps: true });

module.exports = mongoose.model('WebhookLog', webhookLogSchema);
