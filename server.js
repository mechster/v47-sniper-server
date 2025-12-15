// server.js - V93: Pattern First (No Guessing)
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
// 🧠 V93 LOGIC: STRICT PATTERNS ONLY
// =========================================================================

function getPrediction(history, lossStreak) {
    if (!Array.isArray(history) || history.length < 3) return { pred: 'B', mode: "WAIT", reason: "Gathering Data" };
    let last = history[0]; 

    // --- 1. LOSS REACTION ---
    // If we lose 2 times, the pattern has clearly shifted. 
    // Invert the last result to catch the new flow.
    if (lossStreak >= 2) {
        return { pred: last, mode: "INVERT", reason: "Anti-Loss Switch" };
    }

    // --- 2. PATTERN RECOGNITION ---

    // A. PING-PONG (P B P -> Predict B)
    // Checks last 3 hands: [0]!=[1] AND [1]!=[2]
    if (history[0] !== history[1] && history[1] !== history[2]) {
        let next = (last === 'B' ? 'P' : 'B');
        return { pred: next, mode: "PING-PONG", reason: "Chop Detected" };
    }

    // B. 2-2 CYCLE (B B P -> Predict P)
    // Checks if we have a "Pair then Single". Goal: Complete the second pair.
    // Logic: [0]!=[1] (Change happened) AND [1]==[2] (Previous was pair)
    if (history[0] !== history[1] && history[1] === history[2]) {
        // We have [Change] after [Pair]. 
        // Example: P(0) B(1) B(2). We want P next.
        return { pred: last, mode: "2-2 CYCLE", reason: "Completing Pair" };
    }

    // C. STREAK 3+ (B B B -> Predict B)
    // Only ride if streak is established (3 or more).
    let streak = 0;
    for(let i=0; i<history.length; i++) { if(history[i] === last) streak++; else break; }
    
    if (streak >= 3) {
        return { pred: last, mode: "DRAGON", reason: `Streak ${streak}` };
    }

    // --- 3. SAFETY NET ---
    // If none of the above match, the table is undefined (e.g. Streak 2).
    // DO NOT BET.
    return { pred: last, mode: "WAIT", reason: "No Clear Pattern" };
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

app.get('/', (req, res) => res.send('V93 Pattern First Server'));
app.listen(3000, () => console.log('✅ Server Active'));