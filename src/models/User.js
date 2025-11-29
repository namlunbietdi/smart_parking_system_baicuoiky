/**
 * src/models/User.js
 * User schema: email, passwordHash, role
 * role: 'admin' | 'operator' | 'viewer'
 */
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    email: { type: String, required: true, lowercase: true, unique: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ['admin', 'operator', 'viewer'], default: 'operator' },
    name: { type: String, default: '' },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', userSchema);