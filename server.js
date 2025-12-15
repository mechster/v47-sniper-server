// server.js - V92: Ping-Pong Defender + Smart Switch
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
// 🧠 V92 LOGIC: SMART STRUCTURE
// =========================================================================

function getPrediction(history, lossStreak) {
    if (!Array.isArray(history) || history.length < 1) return { pred: 'B', mode: "WAIT", reason: "Gathering Data" };
    
    let last = history[0]; 
    let secondLast = history.length > 1 ? history[1] : null;

    // --- 1. SMART SWITCH (The Fix) ---
    // If we just lost, don't blindly follow. Check the texture.
    if (lossStreak >= 1) {
        
        // CHECK PING-PONG (P B or B P)
        if (secondLast && last !== secondLast) {
            // We just lost on a switch. It's likely Ping-Pong.
            // DO NOT follow the winner. Bet OPPOSITE of the winner.
            let next = (last === 'B' ? 'P' : 'B');
            return { pred: next, mode: "PING-PONG", reason: "Defending Chop" };
        }

        // CHECK STREAK (B B or P P)
        if (secondLast && last === secondLast) {
            // We just lost on a repeat. It's likely a Dragon starting.
            // Follow the winner.
            return { pred: last, mode: "DRAGON", reason: "Defending Streak" };
        }
        
        // Default Invert if no clear data
        return { pred: last, mode: "INVERT", reason: "Standard Switch" };
    }

    // --- 2. STANDARD PLAY (When Winning) ---
    // Default: Follow the trend (Ride the Dragon)
    return { pred: last, mode: "RIDE", reason: "Trend Following" };
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

app.get('/', (req, res) => res.send('V92 Ping-Pong Defender'));
app.listen(3000, () => console.log('✅ Server Active'));