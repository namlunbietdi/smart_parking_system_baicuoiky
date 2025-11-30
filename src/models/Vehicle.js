/**
 * src/models/Vehicle.js
 * Simple vehicle model to support vehicles list API
 */
const mongoose = require('mongoose');

const vehicleSchema = new mongoose.Schema({
    plate: { type: String, required: true, index: true },
    ownerName: { type: String, default: '' },
    note: { type: String, default: '' },
    lastSeen: { type: Date, default: null },
    createdAt: { type: Date, default: Date.now }
}, { versionKey: false });

module.exports = mongoose.model('Vehicle', vehicleSchema);