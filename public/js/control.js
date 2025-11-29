// public/js/control.js
// Frontend logic for the control page:
// - Send open/close commands to backend (POST /api/gate/:id/command)
// - Display simple toast messages
// - Try to fetch occupancy from /api/occupancy (fallback to local totalSlots)
// - Simple demo helper: simulate recognition updates (only for demo)

// Configuration
const totalSlots = 5; // fixed as requested
let occupied = 0;     // will be updated from server if available

document.addEventListener('DOMContentLoaded', () => {
    const inPlateEl = document.getElementById('inPlate');
    const inMetaEl = document.getElementById('inMeta');
    const outPlateEl = document.getElementById('outPlate');
    const outMetaEl = document.getElementById('outMeta');

    const totalSlotsEl = document.getElementById('totalSlots');
    const freeSlotsEl = document.getElementById('freeSlots');
    const occupiedSlotsEl = document.getElementById('occupiedSlots');

    const toastEl = document.getElementById('toast');

    totalSlotsEl.textContent = totalSlots;

    // Try to get occupancy from server, fallback to local values
    async function loadOccupancy() {
        try {
            const res = await fetch('/api/occupancy', { credentials: 'include' });
            if (res.ok) {
                const json = await res.json();
                if (json && typeof json.occupied === 'number') {
                    occupied = json.occupied;
                }
            }
        } catch (e) {
            // ignore, use local
        }
        updateOccupancyUI();
    }

    function updateOccupancyUI() {
        const free = Math.max(0, totalSlots - occupied);
        freeSlotsEl.textContent = free;
        occupiedSlotsEl.textContent = occupied;
    }

    // toast helper
    function showToast(msg, timeout = 2800) {
        toastEl.textContent = msg;
        toastEl.style.opacity = '1';
        toastEl.style.transform = 'translateY(0)';
        setTimeout(() => {
            toastEl.style.opacity = '0';
            toastEl.style.transform = 'translateY(12px)';
        }, timeout);
    }

    // send gate command
    async function sendCommand(gate, action) {
        try {
            const res = await fetch(`/api/gate/${encodeURIComponent(gate)}/command`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ action })
            });
            const data = await res.json().catch(() => null);
            if (res.ok && data && data.ok) {
                showToast(`Đã gửi lệnh ${action.toUpperCase()} cho ${gate}`);
            } else {
                const msg = (data && data.message) ? data.message : `Lỗi server (${res.status})`;
                showToast(msg);
            }
        } catch (err) {
            console.error(err);
            showToast('Lỗi kết nối tới server');
        }
    }

    // attach event listeners for Open/Close buttons
    document.querySelectorAll('.controls .btn').forEach(btn => {
        btn.addEventListener('click', (ev) => {
            const gate = btn.dataset.gate || btn.closest('.frame')?.closest('.gate-col')?.id;
            // data-gate set on buttons in HTML (gate_in / gate_out). If missing, fallback:
            let gateId = btn.getAttribute('data-gate');
            if (!gateId) {
                const column = btn.closest('.gate-col');
                gateId = column?.id === 'gate-in' ? 'gate_in' : 'gate_out';
            }
            const action = btn.getAttribute('data-action');
            if (!gateId || !action) return;
            sendCommand(gateId, action);
        });
    });

    // Demo: simulate recognition events every 8s (remove/comment in production)
    const demoPlates = ['30A-12345', '29B-67890', '51F-11111', '34C-22222'];
    function randomPlate() {
        return demoPlates[Math.floor(Math.random() * demoPlates.length)];
    }
    function simulateRecognition() {
        // update IN
        const plateIn = randomPlate();
        inPlateEl.textContent = plateIn;
        inMetaEl.textContent = `Confidence: ${(60 + Math.floor(Math.random()*40))}% — ${new Date().toLocaleTimeString()}`;

        // update OUT
        const plateOut = randomPlate();
        outPlateEl.textContent = plateOut;
        outMetaEl.textContent = `Confidence: ${(60 + Math.floor(Math.random()*40))}% — ${new Date().toLocaleTimeString()}`;
    }
    // run initial
    simulateRecognition();
    // periodic demo update
    setInterval(simulateRecognition, 8000);

    // load occupancy initially
    loadOccupancy();

    // OPTIONAL: Listen to realtime updates from server (if you implement websocket/firebase)
    // For now, no realtime. You can expose an endpoint /api/occupancy/subscribe or use Server-Sent Events.
});