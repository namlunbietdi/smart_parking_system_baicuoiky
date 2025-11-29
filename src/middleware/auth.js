/**
 * src/middleware/auth.js
 * Middleware bảo vệ route dựa trên cookie JWT
 *
 * Usage:
 *   const { requireAuth, requireRole } = require('./middleware/auth');
 */

const jwt = require('jsonwebtoken');
const User = require('../models/User');
const COOKIE_NAME = process.env.COOKIE_NAME || 'pc_sess';
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret';

async function requireAuth(req, res, next) {
    try {
        const token = req.cookies[COOKIE_NAME] || req.header('Authorization')?.replace('Bearer ', '');
        if (!token) return res.status(401).json({ ok: false, message: 'Not authenticated' });
        const payload = jwt.verify(token, JWT_SECRET);
        const user = await User.findById(payload.sub).select('-passwordHash');
        if (!user) return res.status(401).json({ ok: false, message: 'User not found' });
        req.user = user;
        next();
    } catch (err) {
        console.error('requireAuth err', err);
        return res.status(401).json({ ok: false, message: 'Invalid token' });
    }
}

function requireRole(role) {
    return (req, res, next) => {
        if (!req.user) return res.status(401).json({ ok: false, message: 'Not authenticated' });
        if (req.user.role !== role && req.user.role !== 'admin') {
            return res.status(403).json({ ok: false, message: 'Forbidden' });
        }
        next();
    };
}

module.exports = { requireAuth, requireRole };