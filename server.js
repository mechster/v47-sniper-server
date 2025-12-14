// server.js - V83: Smart V47 Logic + Inversion
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
app.use(cors());
app.use(bodyParser.json());

// =========================================================================
// 🔐 USER DATABASE
// =========================================================================
const USERS = {
    "ADMIN-KEY": { type: "ADMIN", active: true, bound_device: null },
    "DEMO-USER": { type: "TRIAL", hands_left: 5000, active: true, bound_device: null },
    "TRIAL-01":  { type: "TRIAL", hands_left: 100, active: true, bound_device: null },
};

// =========================================================================
// 🧠 V83 LOGIC: CYCLE + INVERSION (NO STATIC V24)
// =========================================================================
const STATIC_FALLBACK = ['P','B','P','B','B','P','B','P','P','B','P','B'];

function getPrediction(history, lossStreak) {
    if (history.length < 1) return { pred: 'B', mode: "WAIT" };
    let lastResult = history[0]; 

    // --- 1. AUTO-INVERSION (Fix for "Predicting Opposite") ---
    // If we lost 2 times in a row, the current pattern is WRONG.
    // We strictly bet on the OPPOSITE of what the static logic would say,
    // OR we just "Follow the Trend" (Last Winner).
    if (lossStreak >= 2) {
        // Simple Fix: If losing, just follow the shoe (Bet Last Winner)
        return { pred: lastResult, mode: "INVERSION", reason: "Anti-Loss Switch" };
    }

    // --- 2. CYCLE MATCHING (V47 Logic) ---
    // Scans for patterns length 3, 4, 5, 6
    for (let len = 3; len <= 6; len++) {
        if (history.length >= len * 2) {
            let isMatch = true;
            for (let i = 0; i < len; i++) {
                if (history[i] !== history[i + len]) { isMatch = false; break; }
            }
            if (isMatch) return { pred: history[len-1], mode: `CYCLE-${len}`, reason: `${len}-Hand Cycle` };
        }
    }

    // --- 3. DRAGON RIDER ---
    let streakCount = 0;
    for(let i=0; i<history.length; i++) { if(history[i] === lastResult) streakCount++; else break; }
    if (streakCount >= 3) return { pred: lastResult, mode: "DRAGON", reason: `Streak ${streakCount}` };

    // --- 4. CHOP RIDER ---
    if (history.length >= 3 && history[0] !== history[1] && history[1] !== history[2]) {
        let next = (history[0] === 'B' ? 'P' : 'B');
        return { pred: next, mode: "CHOP", reason: "Ping-Pong" };
    }

    // --- 5. FALLBACK ---
    let idx = history.length % STATIC_FALLBACK.length;
    return { pred: STATIC_FALLBACK[idx], mode: "BASE", reason: "Standard" };
}

// =========================================================================
// 🛡️ API HANDLERS
// =========================================================================
function checkAccess(key, deviceId) {
    const user = USERS[key];
    if (!user || !user.active) return { allowed: false, msg: "Invalid Key" };
    if (key !== "DEMO-USER") {
        if (user.bound_device === null) user.bound_device = deviceId;
        else if (user.bound_device !== deviceId) return { allowed: false, msg: "Device Locked" };
    }
    return { allowed: true, msg: "OK" };
}

app.post('/api/verify', (req, res) => {
    const check = checkAccess(req.body.key, req.body.deviceId);
    res.json({ success: check.allowed, message: check.msg });
});

app.post('/api/predict', (req, res) => {
    // We accept lossStreak to trigger Inversion
    const { history, key, deviceId, lossStreak } = req.body;
    const check = checkAccess(key, deviceId);
    
    if (!check.allowed) return res.status(401).json({ error: check.msg });

    const result = getPrediction(history, lossStreak || 0);

    res.json({
        success: true,
        prediction: result.pred,
        mode: result.mode,
        reason: result.reason,
        status: check.msg
    });
});

app.get('/', (req, res) => res.send('V83 Smart Server Active'));
app.listen(3000, () => console.log('✅ Server Active'));