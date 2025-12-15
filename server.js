// server.js - V88: Structured 2-2 Cycle + Late Streak
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
// 🧠 V88 LOGIC: 2-2 STRUCTURE + LATE STREAK
// =========================================================================
const STATIC_FALLBACK = ['P','B','P','B','B','P','B','P','P','B','P','B'];

function getPrediction(history, lossStreak) {
    if (!Array.isArray(history) || history.length < 1) return { pred: 'B', mode: "WAIT", reason: "Need Data" };
    let last = history[0]; 

    // --- 1. CRITICAL: AUTO-INVERSION ---
    // If the 2-2 logic fails twice (e.g., table is actually Ping Pong or Chaos),
    // we INVERT to sync with the reality.
    if (lossStreak >= 2) {
        return { pred: last, mode: "INVERT", reason: "Anti-Loss Switch" };
    }

    // --- 2. CALCULATE CURRENT STREAK ---
    let streak = 0;
    for(let i=0; i<history.length; i++) { 
        if(history[i] === last) streak++; else break; 
    }

    // --- 3. SAFETY: PING-PONG DETECTION ---
    // If the last 4 hands were strictly chop (P B P B), we MUST play Ping-Pong.
    // The "2-2 Logic" (Rule #1 below) would destroy us in Ping-Pong.
    if (history.length >= 4) {
        if (history[0]!=history[1] && history[1]!=history[2] && history[2]!=history[3]) {
            let next = (last === 'B' ? 'P' : 'B');
            return { pred: next, mode: "PING-PONG", reason: "Chop Detected" };
        }
    }

    // --- 4. THE 2-2 / LATE STREAK LOGIC ---

    // RULE A: Streak is 1 (e.g., ... P B)
    // Goal: Make it a pair (2-2).
    // Predict: SAME (B)
    if (streak === 1) {
        return { pred: last, mode: "PAIRING", reason: "Targeting 2-2" };
    }

    // RULE B: Streak is 2 (e.g., ... P B B)
    // Goal: Cut the pair (2-2).
    // Predict: SWITCH (P)
    if (streak === 2) {
        let next = (last === 'B' ? 'P' : 'B');
        return { pred: next, mode: "CUT-2", reason: "Targeting 2-2" };
    }

    // RULE C: Streak is 3 (e.g., ... B B B)
    // Goal: Still assume it's not a dragon yet (User request).
    // Predict: SWITCH (P)
    if (streak === 3) {
        let next = (last === 'B' ? 'P' : 'B');
        return { pred: next, mode: "CUT-3", reason: "Wait for Streak > 4" };
    }

    // RULE D: Streak is 4+ (e.g., ... B B B B)
    // Goal: Now we believe the Dragon.
    // Predict: SAME (B)
    if (streak >= 4) {
        return { pred: last, mode: "DRAGON", reason: "Streak > 4" };
    }

    // Fallback
    return { pred: last, mode: "SAFE", reason: "Default" };
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
        res.json({ success: true, prediction: "B", mode: "SAFE", reason: "Error" });
    }
});

app.get('/', (req, res) => res.send('V88 2-2 Logic Server'));
app.listen(3000, () => console.log('✅ Server Active'));