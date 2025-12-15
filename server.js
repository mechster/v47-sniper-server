// server.js - V87: Instant Reaction Engine
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
// 🧠 V87 LOGIC: SAME / DIFF (High Speed)
// =========================================================================
const STATIC_FALLBACK = ['P','B','P','B','B','P','B','P','P','B','P','B'];

function getPrediction(history, lossStreak) {
    if (!Array.isArray(history) || history.length < 2) return { pred: 'B', mode: "WAIT", reason: "Need 2 Hands" };
    let last = history[0];      // Newest
    let secondLast = history[1]; // Before Newest

    // --- 1. CRITICAL: AUTO-INVERSION ---
    // If we are wrong 2 times, the "Same/Diff" logic is flipping.
    // We invert to catch the 2-1 or 1-2 pattern.
    if (lossStreak >= 2) {
        return { pred: last, mode: "INVERT", reason: "Anti-Loss Switch" };
    }

    // --- 2. THE INSTANT REACTOR ---
    
    // CASE A: STREAK (Last 2 were same) -> PREDICT SAME
    // Example: P P -> Predict P
    if (last === secondLast) {
        return { pred: last, mode: "STREAK", reason: "Repeat Detected" };
    }

    // CASE B: CHOP (Last 2 were diff) -> PREDICT DIFF
    // Example: P B -> Predict P
    if (last !== secondLast) {
        let next = (last === 'B' ? 'P' : 'B');
        return { pred: next, mode: "CHOP", reason: "Switch Detected" };
    }

    // --- 3. FALLBACK ---
    return { pred: last, mode: "SAFE", reason: "Default" };
}

// =========================================================================
// 🛡️ API HANDLERS
// =========================================================================
function checkAccess(key, deviceId) {
    if (!key) return { allowed: false, msg: "No Key" };
    const user = USERS[key];
    if (!user || !user.active) return { allowed: false, msg: "Invalid" };
    if (key !== "DEMO-USER") {
        if (user.bound_device === null) user.bound_device = deviceId;
        else if (user.bound_device !== deviceId) return { allowed: false, msg: "Locked" };
    }
    return { allowed: true, msg: "OK" };
}

app.post('/api/verify', (req, res) => {
    const check = checkAccess(req.body.key, req.body.deviceId);
    res.json({ success: check.allowed, message: check.msg });
});

app.post('/api/predict', (req, res) => {
    try {
        const { history = [], key, deviceId, lossStreak = 0 } = req.body;
        const check = checkAccess(key, deviceId);
        if (!check.allowed) return res.status(401).json({ error: check.msg });

        const result = getPrediction(history, lossStreak);
        res.json({ success: true, prediction: result.pred, mode: result.mode, reason: result.reason });
    } catch (e) {
        res.json({ success: true, prediction: "B", mode: "SAFE", reason: "Error" });
    }
});

app.get('/', (req, res) => res.send('V87 Speed Server'));
app.listen(3000, () => console.log('✅ Server Active'));