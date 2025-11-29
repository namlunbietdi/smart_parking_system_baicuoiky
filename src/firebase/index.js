const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

function initFirebaseIfConfigured() {
    try {
        const keyPathEnv = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
        const dbUrl = process.env.FIREBASE_DATABASE_URL;

        if (!keyPathEnv || !dbUrl) {
            console.log('Firebase not configured: FIREBASE_SERVICE_ACCOUNT_PATH or FIREBASE_DATABASE_URL missing.');
            return null;
        }

        const keyPath = path.resolve(keyPathEnv);
        if (!fs.existsSync(keyPath)) {
            console.log(`Firebase service account key not found at: ${keyPath}`);
            console.log('Set FIREBASE_SERVICE_ACCOUNT_PATH in .env to point to the downloaded serviceAccountKey.json, or leave it empty to disable Firebase.');
            return null;
        }

        let serviceAccount;
        try {
            serviceAccount = require(keyPath);
        } catch (err) {
            // fallback: read & parse
            try {
                const raw = fs.readFileSync(keyPath, 'utf8');
                serviceAccount = JSON.parse(raw);
            } catch (err2) {
                console.error('Failed to load/parse Firebase service account JSON:', err2);
                return null;
            }
        }

        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            databaseURL: dbUrl
        });
        console.log('Firebase admin initialized (project:', serviceAccount.project_id || 'unknown', ')');
        return admin;
    } catch (err) {
        console.error('Firebase init error', err);
        return null;
    }
}

module.exports = { initFirebaseIfConfigured };