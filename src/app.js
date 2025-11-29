/**
 * src/app.js
 * Entry point Express - cấu hình middleware, route auth, kết nối MongoDB
 * (Đã thêm route '/dashboard' để trả file public/dashboard.html)
 */
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cors = require('cors');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const path = require('path');

const authRoutes = require('./routes/auth');
const { initFirebaseIfConfigured } = require('./firebase');

const PORT = process.env.PORT || 4000;
const MONGODB_URI = process.env.MONGODB_URI;

async function start() {
    // MongoDB connect
    if (!MONGODB_URI) {
        console.error('MONGODB_URI not set. Check .env');
        process.exit(1);
    }
    await mongoose.connect(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });
    console.log('Connected to MongoDB');

    // Optional Firebase init
    initFirebaseIfConfigured();

    const app = express();

    // Security
    app.use(helmet());
    app.use(rateLimit({ windowMs: 1000 * 60, max: 200 })); // basic rate limit
    app.use(morgan('dev'));

    // CORS: allow frontend origin (set in .env)
    const corsOrigin = process.env.CORS_ORIGIN || 'http://localhost:3000';
    app.use(cors({
        origin: corsOrigin,
        credentials: true
    }));

    app.use(bodyParser.json());
    app.use(bodyParser.urlencoded({ extended: true }));
    app.use(cookieParser());

    // Routes
    app.use('/api/auth', authRoutes);

    // Example protected route
    app.get('/api/health', (req, res) => res.json({ ok: true, ts: Date.now() }));

    // Serve static frontend
    const publicPath = path.join(__dirname, '..', 'public');
    app.use('/', express.static(publicPath));

    // Serve dashboard explicitly at /dashboard (so redirect to /dashboard works)
    app.get('/dashboard', (req, res) => {
        res.sendFile(path.join(publicPath, 'dashboard.html'));
    });

    // fallback to index.html for other routes (if you have SPA)
    app.get('*', (req, res) => {
        res.sendFile(path.join(publicPath, 'index.html'));
    });

    app.listen(PORT, () => {
        console.log(`Server started on port ${PORT}`);
    });
}

start().catch(err => {
    console.error('Failed to start', err);
    process.exit(1);
});