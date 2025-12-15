// server.js - V85: Anti-Chaos + Structural Logic
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
// 🧠 V85 PREDICTION ENGINE (Structural)
// =========================================================================
const STATIC_FALLBACK = ['P','B','P','B','B','P','B','P','P','B','P','B'];

function getPrediction(history, lossStreak) {
    if (!Array.isArray(history) || history.length < 1) return { pred: 'B', mode: "WAIT", reason: "Need Data" };
    let lastResult = history[0]; 

    // --- 1. CRITICAL: AUTO-INVERSION ---
    // If we lost 2 times, the pattern has shifted. Invert the logic.
    // Instead of guessing, we just "Follow the Winner" to catch the streak/chop.
    if (lossStreak >= 2) {
        return { pred: lastResult, mode: "INVERT", reason: "Anti-Loss Switch" };
    }

    // --- 2. IMMEDIATE STRUCTURE (The Fix for 2-2, 2-1, PingPong) ---
    
    // Check 2-2 (PP BB PP ...)
    // Pattern: [0]!=[1], [1]==[2], [2]!=[3], [3]==[4]
    // Example: P B B P P
    if (history.length >= 4) {
        // If we see B B P ... Predict P (to make it B B P P)
        if (history[0] !== history[1] && history[1] === history[2]) {
             return { pred: history[0], mode: "2-2", reason: "2-2 Structure" };
        }
    }

    // Check 2-1 (PP B PP B)
    if (history.length >= 3) {
        // If we see B B P ... Predict B (to make it B B P B)
        // Wait, 2-1 is "Pair then Single". 
        // If we have P P B, we expect P next.
        if (history[0] !== history[1] && history[1] === history[2]) {
             // This overlaps with 2-2 start. 
             // We check history[3]. If history[3] was same as [2], it's a 2-2 world.
             // If history[3] was diff, it might be 2-1.
             if (history.length >= 4 && history[2] !== history[3]) {
                 return { pred: history[1], mode: "2-1", reason: "2-1 Structure" };
             }
        }
    }

    // Check Ping Pong (P B P)
    if (history.length >= 2) {
        if (history[0] !== history[1]) {
             // We have a chop (P B). Predict P.
             let next = (lastResult === 'B' ? 'P' : 'B');
             return { pred: next, mode: "PING-PONG", reason: "Chop Detected" };
        }
    }

    // --- 3. DRAGON RIDER ---
    let streakCount = 0;
    for(let i=0; i<history.length; i++) { if(history[i] === lastResult) streakCount++; else break; }
    if (streakCount >= 3) return { pred: lastResult, mode: "DRAGON", reason: `Streak ${streakCount}` };

    // --- 4. FALLBACK ---
    let idx = history.length % STATIC_FALLBACK.length;
    return { pred: STATIC_FALLBACK[idx], mode: "BASE", reason: "Standard" };
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

app.get('/', (req, res) => res.send('V85 Structural Server'));
app.listen(3000, () => console.log('✅ Server Active'));