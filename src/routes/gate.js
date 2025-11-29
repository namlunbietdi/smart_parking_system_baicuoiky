/**
 * src/routes/gate.js
 * Route để điều khiển gate (mở/đóng)
 * POST /api/gate/:id/command
 * body: { action: "open"|"close", note?: string }
 *
 * Yêu cầu:
 *  - requireAuth middleware (user phải login)
 *  - requireRole('operator') hoặc admin
 *
 * Hành động:
 *  - nếu Firebase admin khởi tạo được -> ghi lệnh vào Realtime DB tại /gates/{id}/commands (push)
 *  - trả về JSON { ok: true, command }
 */

const express = require('express');
const router = express.Router();
const { requireAuth, requireRole } = require('../middleware/auth');
const { initFirebaseIfConfigured } = require('../firebase');

router.post('/:id/command', requireAuth, requireRole('operator'), async (req, res) => {
    try {
        const gateId = req.params.id;
        const { action, note } = req.body || {};

        if (!gateId || !action) {
            return res.status(400).json({ ok: false, message: 'Missing gate id or action' });
        }
        if (!['open', 'close'].includes(action)) {
            return res.status(400).json({ ok: false, message: 'Invalid action' });
        }

        // build command payload
        const cmd = {
            action,
            by: req.user.email || req.user._id,
            role: req.user.role,
            note: note || '',
            ts: Date.now()
        };

        const admin = initFirebaseIfConfigured();
        if (!admin) {
            // Nếu không có Firebase, vẫn trả về success nhưng kèm cảnh báo
            console.warn('Firebase admin not initialized - command not pushed to realtime DB');
            return res.json({ ok: true, warning: 'Firebase not initialized, command not pushed', command: cmd });
        }

        // push command into Realtime DB: /gates/{id}/commands -> push a new command
        const ref = admin.database().ref(`/gates/${gateId}/commands`);
        const newRef = await ref.push(cmd);

        // Optionally write 'lastCommand' for quick read by device
        await admin.database().ref(`/gates/${gateId}/lastCommand`).set({ ...cmd, key: newRef.key });

        return res.json({ ok: true, command: { key: newRef.key, ...cmd } });
    } catch (err) {
        console.error('Gate command error', err);
        return res.status(500).json({ ok: false, message: 'Server error' });
    }
});

module.exports = router;