// server.js - V70: Adaptive Transition Logic
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
app.use(cors());
app.use(bodyParser.json());

// =========================================================================
// 🔐 USER DATABASE (20 TRIAL KEYS + PAID)
// =========================================================================
const USERS = {
    "ADMIN-KEY": { type: "ADMIN", active: true, bound_device: null },
    "DEMO-USER": { type: "TRIAL", hands_left: 5000, active: true, bound_device: null },
    "TRIAL-01":  { type: "TRIAL", hands_left: 100, active: true, bound_device: null },
    // ... add more trial keys here ...
};

// =========================================================================
// 🧠 V70 ADAPTIVE BRAIN
// =========================================================================
const STATIC_PATTERN = ['P','B','P','B','B','P','B','P','P','B','P','B'];

function getPrediction(history) {
    if (history.length < 1) return { pred: STATIC_PATTERN[0], mode: "WAIT", reason: "Need Data" };
    let lastResult = history[0]; 

    // --- 1. DETECT STREAK COUNT ---
    let streakCount = 0;
    for(let i=0; i<history.length; i++) { 
        if(history[i] === lastResult) streakCount++; else break; 
    }

    // --- 2. CHECK FOR 3-3 CYCLE (CRITICAL TRANSITION) ---
    // If we have 3 in a row, is it a 3-3 pattern (PP P BB B)?
    // If yes, we must bet OPPOSITE (Break the streak), not Dragon.
    if (streakCount === 3 && history.length >= 6) {
        // Check if previous 3 were the opposite
        let prev3 = true;
        for(let i=3; i<6; i++) { if(history[i] === lastResult) prev3 = false; }
        
        if(prev3) {
            // It looks like a 3-3 pattern. Predict SWITCH.
            let nextPred = (lastResult === 'B' ? 'P' : 'B');
            return { pred: nextPred, mode: "3-3 CYCLE", reason: "Cycle Switch" };
        }
    }

    // --- 3. AGGRESSIVE DRAGON (Capture Streaks) ---
    // User Requirement: "Dont miss streaks".
    // If we have 3 or more (and it wasn't a 3-3 switch above), RIDE IT.
    if (streakCount >= 3) {
        return { pred: lastResult, mode: "DRAGON", reason: `Streak ${streakCount}` };
    }

    // --- 4. PATTERN SCANNER (Priority Order: 2-2 -> 2-1) ---
    
    // Check 2-2 (PPBB) - Length 4
    if (history.length >= 8) {
        let is22 = true;
        for(let i=0; i<4; i++) { if(history[i] !== history[i+4]) is22 = false; }
        if(is22) return { pred: history[3], mode: "2-2 CYCLE", reason: "Repeating 2-2" };
    }

    // Check 2-1 (PPB) - Length 3
    if (history.length >= 6) {
        let is21 = true;
        for(let i=0; i<3; i++) { if(history[i] !== history[i+3]) is21 = false; }
        if(is21) return { pred: history[2], mode: "2-1 CYCLE", reason: "Repeating 2-1" };
    }

    // --- 5. PING PONG (CHOP) ---
    // If last 2 were different, assume chop continues
    if (history.length >= 2 && history[0] !== history[1]) {
        // Double check: If we have P B, predict P.
        let nextPred = (lastResult === 'B' ? 'P' : 'B');
        return { pred: nextPred, mode: "PING-PONG", reason: "Chop Detected" };
    }

    // --- 6. STATIC BACKUP ---
    let idx = history.length % STATIC_PATTERN.length;
    return { pred: STATIC_PATTERN[idx], mode: "STATIC", reason: "Base Strategy" };
}

// =========================================================================
// 🛡️ SECURITY
// =========================================================================
function checkAccess(key, deviceId) {
    const user = USERS[key];
    if (!user || !user.active) return { allowed: false, msg: "Invalid Key" };
    if (user.type === "ADMIN") return { allowed: true, msg: "Admin" };

    if (key !== "DEMO-USER") {
        if (user.bound_device === null) user.bound_device = deviceId;
        else if (user.bound_device !== deviceId) return { allowed: false, msg: "Device Locked" };
    }

    if (user.type === "TRIAL") {
        if (user.hands_left <= 0) return { allowed: false, msg: "Trial Ended" };
        return { allowed: true, msg: `Trial: ${user.hands_left}` };
    }
    
    if (user.type === "PAID") {
        const today = new Date();
        const expiry = new Date(user.expires);
        if (today > expiry) return { allowed: false, msg: "Expired" };
        const diff = Math.ceil((expiry - today) / (86400000));
        return { allowed: true, msg: `${diff} Days` };
    }
    return { allowed: false, msg: "Error" };
}

app.post('/api/verify', (req, res) => {
    const check = checkAccess(req.body.key, req.body.deviceId);
    res.json({ success: check.allowed, message: check.msg });
});

app.post('/api/predict', (req, res) => {
    const { history, key, deviceId } = req.body;
    const check = checkAccess(key, deviceId);
    if (!check.allowed) return res.status(401).json({ error: check.msg });
    if (USERS[key].type === "TRIAL" && USERS[key].type !== "ADMIN") USERS[key].hands_left--;
    const result = getPrediction(history);
    res.json({ success: true, prediction: result.pred, mode: result.mode, reason: result.reason, status: check.msg });
});

app.get('/api/reset', (req, res) => {
    if(USERS[req.query.key]) { USERS[req.query.key].bound_device = null; res.send("Reset OK"); }
});

app.get('/', (req, res) => res.send('V70 Adaptive Server Active'));
app.listen(3000, () => console.log('✅ Server Active'));