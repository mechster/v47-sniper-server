// server.js - V91: Instant Inversion (1 Loss Flip)
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
// 🧠 V91 LOGIC: QUICK FLIP
// =========================================================================
const STATIC_FALLBACK = ['P','B','P','B','B','P','B','P','P','B','P','B'];

function getPrediction(history, lossStreak) {
    if (!Array.isArray(history) || history.length < 1) return { pred: 'B', mode: "WAIT", reason: "Gathering Data" };
    let last = history[0]; 

    // --- 1. INSTANT INVERSION (User Request) ---
    // If we lost even ONCE, we assume our current logic is wrong.
    // We immediately bet against our previous logic (or follow the trend).
    // Simple way: "Follow the Winner" of the loss.
    if (lossStreak >= 1) {
        return { pred: last, mode: "INVERT", reason: "Quick Flip" };
    }

    // --- 2. STANDARD PATTERN LOGIC (When Winning) ---
    
    // Check Streak 3+
    let streak = 0;
    for(let i=0; i<history.length; i++) { if(history[i] === last) streak++; else break; }
    if (streak >= 3) return { pred: last, mode: "DRAGON", reason: "Streak 3+" };

    // Check Chop
    if (history.length >= 2 && history[0] !== history[1]) {
        let next = (last === 'B' ? 'P' : 'B');
        return { pred: next, mode: "CHOP", reason: "Ping-Pong" };
    }

    // Check 2-2
    if (history.length >= 4) {
        if (history[0]===history[1] && history[2]===history[3] && history[1]!==history[2]) {
             let next = (last === 'B' ? 'P' : 'B');
             return { pred: next, mode: "2-2 CYCLE", reason: "Structure" };
        }
    }

    // Fallback
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
        res.json({ success: true, prediction: "B", mode: "WAIT", reason: "Error" });
    }
});

app.get('/', (req, res) => res.send('V91 Invert Server'));
app.listen(3000, () => console.log('✅ Server Active'));