const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true
    },
    password: {
        type: String,
        required: true
    },
    resetToken: String,
    resetTokenExpiry: Date,
    role: {
        type: String,
        enum: ['superadmin', 'user'],
        default: 'user'
    },
    ghlUserId: String,  // Link to GHL User ID
    agencyId: String,   // Link to GHL Agency ID (for 'agencyadmin' type users)
    locationIds: [String] // Array of GHL Location IDs this user has installed the app in/has access to
} , { timestamps: true });

// Hash password before saving
userSchema.pre('save', async function(next) {
    if (!this.isModified('password')) return next();
    this.password = await bcrypt.hash(this.password, 12);
    next();
});

// Method to check password
userSchema.methods.comparePassword = async function(candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
