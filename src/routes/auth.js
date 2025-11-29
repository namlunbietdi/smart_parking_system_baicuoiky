/**
 * src/routes/auth.js
 * POST /login
 * POST /logout
 * GET  /me
 *
 * Trả JWT trong HttpOnly cookie (COOKIE_NAME)
 */

const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const User = require('../models/User');

const COOKIE_NAME = process.env.COOKIE_NAME || 'pc_sess';
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

// helper tạo token payload
function signToken(user) {
    const payload = { sub: user._id.toString(), role: user.role, email: user.email };
    return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

// POST /api/auth/login
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body || {};
        if (!email || !password) return res.status(400).json({ ok: false, message: 'Missing email or password' });

        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user) return res.status(401).json({ ok: false, message: 'Invalid credentials' });

        const match = await bcrypt.compare(password, user.passwordHash);
        if (!match) return res.status(401).json({ ok: false, message: 'Invalid credentials' });

        const token = signToken(user);

        // Set cookie HttpOnly
        res.cookie(COOKIE_NAME, token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 1000 * 60 * 60 * 24 * 7 // 7 days
        });

        return res.json({ ok: true, redirect: '/dashboard' });
    } catch (err) {
        console.error('Login error:', err);
        return res.status(500).json({ ok: false, message: 'Server error' });
    }
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
    res.clearCookie(COOKIE_NAME);
    return res.json({ ok: true });
});

// GET /api/auth/me
router.get('/me', async (req, res) => {
    try {
        const token = req.cookies[COOKIE_NAME] || req.header('Authorization')?.replace('Bearer ', '');
        if (!token) return res.status(401).json({ ok: false, message: 'Not authenticated' });

        const payload = jwt.verify(token, JWT_SECRET);
        const user = await User.findById(payload.sub).select('-passwordHash');
        if (!user) return res.status(401).json({ ok: false, message: 'User not found' });

        return res.json({ ok: true, user });
    } catch (err) {
        console.error('/me error', err);
        return res.status(401).json({ ok: false, message: 'Invalid token' });
    }
});

module.exports = router;