// server.js - V89: Sniper Mode (Wait Streak 1-4, Ride 5)
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
// 🧠 V89 LOGIC: SNIPER MODE
// =========================================================================

function getPrediction(history, lossStreak) {
    if (!Array.isArray(history) || history.length < 1) return { pred: 'B', mode: "WAIT", reason: "Gathering Data" };
    let last = history[0]; 

    // --- 1. CRITICAL: AUTO-INVERSION ---
    if (lossStreak >= 2) {
        return { pred: last, mode: "INVERT", reason: "Anti-Loss Switch" };
    }

    // --- 2. CALCULATE CURRENT STREAK ---
    let streak = 0;
    for(let i=0; i<history.length; i++) { 
        if(history[i] === last) streak++; else break; 
    }

    // --- 3. PATTERN RECOGNITION (Exceptions to "Wait") ---

    // A. STRICT PING-PONG (Must see P B P ...)
    // If we are at Streak 1 (e.g. B), check if prev was P, and prev-prev was B.
    if (streak === 1 && history.length >= 3) {
        // History: B(0) P(1) B(2) ...
        if (history[0]!==history[1] && history[1]!==history[2]) {
             let next = (last === 'B' ? 'P' : 'B');
             return { pred: next, mode: "PING-PONG", reason: "Confirmed Chop" };
        }
    }

    // B. STRICT 2-2 CYCLE (Must see BB PP ...)
    // If we are at Streak 2 (e.g. BB), check if prev was PP.
    if (streak === 2 && history.length >= 4) {
        // History: B(0) B(1) P(2) P(3) ...
        if (history[0]===history[1] && history[2]===history[3] && history[1]!==history[2]) {
             let next = (last === 'B' ? 'P' : 'B');
             return { pred: next, mode: "2-2 CYCLE", reason: "Confirmed 2-2" };
        }
    }

    // --- 4. SNIPER STREAK LOGIC (Your Request) ---

    // Streak 1: WAIT. (Don't guess Pair vs Chop).
    if (streak === 1) {
        return { pred: last, mode: "WAIT", reason: "Streak 1 - Unsure" };
    }

    // Streak 2: WAIT. (Don't try to cut, unless verified 2-2 above).
    if (streak === 2) {
        return { pred: last, mode: "WAIT", reason: "Streak 2 - Unsure" };
    }

    // Streak 3: WAIT. (Don't cut).
    if (streak === 3) {
        return { pred: last, mode: "WAIT", reason: "Streak 3 - Waiting" };
    }

    // Streak 4: WAIT. (Don't cut).
    if (streak === 4) {
        return { pred: last, mode: "WAIT", reason: "Streak 4 - Waiting" };
    }

    // Streak 5+: RIDE THE DRAGON.
    if (streak >= 5) {
        return { pred: last, mode: "DRAGON", reason: "Streak 5+ Detected" };
    }

    // Default
    return { pred: last, mode: "WAIT", reason: "No Signal" };
}

// =========================================================================
// 🛡️ API
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
        res.json({ success: true, prediction: "B", mode: "WAIT", reason: "Error" });
    }
});

app.get('/', (req, res) => res.send('V89 Sniper Server'));
app.listen(3000, () => console.log('✅ Server Active'));