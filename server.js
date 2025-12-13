// server.js - V75: Optimized High-Speed Logic
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
// 🧠 V75 FAST LOGIC
// =========================================================================
const PATTERNV24 = ['P','B','P','B','B','P','B','P','P','B','P','B'];

function getPrediction(history) {
    if (history.length < 1) return { pred: PATTERNV24[0], mode: "WAIT" };
    let lastResult = history[0]; 

    // 1. STREAK (Priority)
    let streak = 0;
    for(let i=0; i<history.length; i++) { if(history[i] === lastResult) streak++; else break; }
    if (streak >= 3) return { pred: lastResult, mode: "DRAGON" };

    // 2. PATTERN LOOPS
    // Optimized: Only check 4 and 3 (Most common) to save speed
    const cycles = [4, 3]; 
    for (let len of cycles) {
        if (history.length >= len * 2) {
            let isMatch = true;
            for (let i = 0; i < len; i++) {
                if (history[i] !== history[i + len]) { isMatch = false; break; }
            }
            if (isMatch) return { pred: history[len - 1], mode: `CYCLE-${len}` };
        }
    }

    // 3. MASTER PATTERN
    let idx = history.length % PATTERNV24.length;
    return { pred: PATTERNV24[idx], mode: "PATTERN" };
}

// =========================================================================
// 🛡️ API
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

    // Fast response
    const result = getPrediction(history);
    res.json({ success: true, prediction: result.pred, mode: result.mode });
});

app.get('/', (req, res) => res.send('V75 Speed Server'));
app.listen(3000, () => console.log('✅ Server Active'));