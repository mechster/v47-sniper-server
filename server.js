// server.js - V82: Stable PatternV24 + Streak
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
// 🧠 V82 LOGIC: PATTERNV24 + DRAGON
// =========================================================================
const PATTERNV24 = ['P','B','P','B','B','P','B','P','P','B','P','B'];

function getPrediction(history) {
    if (history.length < 1) return { pred: PATTERNV24[0], mode: "WAIT" };
    let lastResult = history[0]; 

    // 1. STREAK CATCHER (Priority)
    // If we see 3 or more of same color, RIDE IT.
    let streakCount = 0;
    for(let i=0; i<history.length; i++) { 
        if(history[i] === lastResult) streakCount++; else break; 
    }

    if (streakCount >= 3) {
        return { pred: lastResult, mode: "DRAGON", reason: `Streak ${streakCount}` };
    }

    // 2. PATTERNV24 (Master Pattern)
    // Strict adherence to the 12-step sequence
    let idx = history.length % PATTERNV24.length;
    let basePred = PATTERNV24[idx];

    return { pred: basePred, mode: "PATTERN V24", reason: "Master Sequence" };
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
    const { history, key, deviceId } = req.body;
    const check = checkAccess(key, deviceId);
    if (!check.allowed) return res.status(401).json({ error: check.msg });
    
    // Logic
    const result = getPrediction(history);
    
    res.json({
        success: true,
        prediction: result.pred,
        mode: result.mode,
        reason: result.reason,
        status: check.msg
    });
});

app.get('/', (req, res) => res.send('V82 Fibonacci Server Active'));
app.listen(3000, () => console.log('✅ Server Active'));