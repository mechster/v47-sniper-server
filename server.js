// server.js - V84: Crash-Proof + Smart Logic
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
// 🧠 V84 PREDICTION ENGINE (Safe Mode)
// =========================================================================
const STATIC_FALLBACK = ['P','B','P','B','B','P','B','P','P','B','P','B'];

function getPrediction(history, lossStreak) {
    // CRASH GUARD: If history is invalid, return Wait
    if (!Array.isArray(history) || history.length < 1) {
        return { pred: 'B', mode: "WAIT", reason: "Waiting for Data" };
    }

    let lastResult = history[0]; 

    // --- 1. AUTO-INVERSION ---
    if (lossStreak >= 2) {
        return { pred: lastResult, mode: "INVERSION", reason: "Anti-Loss Switch" };
    }

    // --- 2. CYCLE MATCHING ---
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
    if (!key) return { allowed: false, msg: "No Key Provided" };
    
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
    try {
        // SAFE DESTRUCTURING: Default to empty array if missing
        const { history = [], key, deviceId, lossStreak = 0 } = req.body;
        
        const check = checkAccess(key, deviceId);
        if (!check.allowed) return res.status(401).json({ error: check.msg });

        // Calculate
        const result = getPrediction(history, lossStreak);

        res.json({
            success: true,
            prediction: result.pred,
            mode: result.mode,
            reason: result.reason,
            status: check.msg
        });

    } catch (error) {
        console.error("SERVER ERROR:", error);
        // Prevent Crash response
        res.json({ success: true, prediction: "B", mode: "RECOVER", reason: "Server Reset" });
    }
});

app.get('/', (req, res) => res.send('V84 Safe Server Active'));
app.listen(3000, () => console.log('✅ Server Active'));