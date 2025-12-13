// server.js - V71: Adaptive Confidence Engine
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
// 🧠 V71 SMART LOGIC
// =========================================================================
const STATIC_PATTERN = ['P','B','P','B','B','P','B','P','P','B','P','B'];

function getPrediction(history) {
    if (history.length < 1) return { pred: STATIC_PATTERN[0], mode: "WAIT", confidence: 0, reason: "Need Data" };
    let lastResult = history[0]; 

    // --- 1. PATTERN STRENGTH ANALYZER ---
    // We scan the last 24 hands to see which pattern is "Dominant"
    let score22 = 0; // P P B B
    let score21 = 0; // P P B
    let scorePing = 0; // P B P B

    // Scan 2-2
    for(let i=0; i<Math.min(history.length, 24); i+=4) {
        if(i+4 < history.length && history[i]===history[i+1] && history[i]!==history[i+2] && history[i+2]===history[i+3]) score22++;
    }
    // Scan 2-1
    for(let i=0; i<Math.min(history.length, 24); i+=3) {
        if(i+3 < history.length && history[i]===history[i+1] && history[i]!==history[i+2]) score21++;
    }

    // --- 2. LOGIC DECISION ---
    
    // A. DRAGON (Streak > 3) -> ALWAYS RIDE
    let streakCount = 0;
    for(let i=0; i<history.length; i++) { if(history[i] === lastResult) streakCount++; else break; }
    
    if (streakCount >= 4) {
        // High Confidence on strong streaks
        return { pred: lastResult, mode: "DRAGON", confidence: 1.5, reason: `Streak ${streakCount}` };
    }

    // B. THE "2-2" TRANSITION CHECK (User's Specific Request)
    // Scenario: ... B B P (Streak 1 of opposite color)
    if (streakCount === 1 && history.length >= 3) {
        // Look at previous: history[1] and history[2] are same (e.g. B B)
        if (history[1] === history[2] && history[0] !== history[1]) {
            // We are at the "Third Leg" of a potential 2-2. (B B P -> ?)
            // RISK: It could be 2-1 (B B P -> B) or 2-2 (B B P -> P).
            
            if (score22 >= score21) {
                // If 2-2 is more common, bet P to complete 2-2.
                // BUT BET LOW (Defensive) because it might fail.
                return { pred: lastResult, mode: "2-2 CHECK", confidence: 0.8, reason: "Attempt 2-2" };
            } else {
                // If 2-1 is more common, bet B (Switch).
                let nextPred = (lastResult === 'B' ? 'P' : 'B');
                return { pred: nextPred, mode: "2-1 CHECK", confidence: 0.8, reason: "Attempt 2-1" };
            }
        }
    }

    // C. THE "2-2" CONFIRMATION
    // Scenario: ... B B P P (Streak 2)
    if (streakCount === 2 && history.length >= 4) {
        // Check if previous 2 were opposite (B B P P)
        if (history[2] === history[3] && history[2] !== history[1]) {
            // Perfect 2-2 block formed.
            // Predict SWITCH to continue 2-2 cycle.
            // HIGH CONFIDENCE because pattern is confirmed.
            let nextPred = (lastResult === 'B' ? 'P' : 'B');
            return { pred: nextPred, mode: "2-2 CYCLE", confidence: 1.5, reason: "Confirmed 2-2" };
        }
    }

    // D. PING PONG
    if (history.length >= 3 && history[0]!==history[1] && history[1]!==history[2]) {
        let nextPred = (lastResult === 'B' ? 'P' : 'B');
        return { pred: nextPred, mode: "PING-PONG", confidence: 1.0, reason: "Chop" };
    }

    // E. DEFAULT
    let idx = history.length % STATIC_PATTERN.length;
    return { pred: STATIC_PATTERN[idx], mode: "STATIC", confidence: 1.0, reason: "Base" };
}

// =========================================================================
// 🛡️ API
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
    
    res.json({ 
        success: true, 
        prediction: result.pred, 
        mode: result.mode, 
        confidence: result.confidence, // NEW FIELD
        reason: result.reason, 
        status: check.msg 
    });
});

app.get('/api/reset', (req, res) => {
    if(USERS[req.query.key]) { USERS[req.query.key].bound_device = null; res.send("Reset OK"); }
});

app.get('/', (req, res) => res.send('V71 Adaptive Server Active'));
app.listen(3000, () => console.log('✅ Server Active'));