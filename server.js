// server.js - V63: Secure Logic Holder (PatternV24 Integrated)
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
app.use(cors());
app.use(bodyParser.json());

// =========================================================================
// 🔐 USER DATABASE (Edit this manually)
// =========================================================================
const USERS = {
    "ADMIN-KEY":   { type: "ADMIN", active: true, bound_device: null },
    "DEMO-USER":   { type: "TRIAL", hands_left: 200, active: true, bound_device: null },
    "VIP-JOHN":    { type: "PAID", expires: "2026-02-15", active: true, bound_device: null }
};

// =========================================================================
// 🧠 SECRET STRATEGY (HIDDEN ON SERVER)
// =========================================================================
const PATTERN = ['P','B','P','B','B','P','B','P','P','B','P','B'];

function checkStrongMirror(history) {
    if (history.length < 18) return false; 
    let matches = 0; let checks = 0;
    // Check if the board is mirroring itself every 6 hands
    for(let i=0; i<6; i++) {
        if (history[history.length - 1 - i] === history[history.length - 7 - i]) matches++;
        checks++;
    }
    // If >80% match, we are in a Mirror
    return (matches >= 4);
}

function getPrediction(history) {
    // 1. Dragon Logic (Priority)
    let streakCount = 0;
    let lastWinner = (history.length > 0) ? history[0] : null;
    if(lastWinner) {
        for(let i=0; i<history.length; i++) { 
            if(history[i] === lastWinner) streakCount++; else break; 
        }
    }
    if (streakCount >= 5) {
        return { pred: lastWinner, mode: "DRAGON", reason: `Streak ${streakCount}` };
    }

    // 2. Mirror Logic (From PatternV24)
    if (checkStrongMirror(history)) {
        // Predict based on what happened 6 hands ago
        let mirrorPred = history[5]; // 6th hand from the start of the pattern
        return { pred: mirrorPred, mode: "MIRROR", reason: "Pattern Mirror" };
    }

    // 3. Base Pattern Logic
    let patternIdx = history.length % PATTERN.length;
    let basePred = PATTERN[patternIdx];

    return { pred: basePred, mode: "PATTERN", reason: "Standard V24" };
}

// =========================================================================
// 🛡️ SECURITY & API
// =========================================================================

function checkAccess(key, deviceId) {
    const user = USERS[key];
    if (!user || !user.active) return { allowed: false, msg: "Invalid Key" };
    if (user.type === "ADMIN") return { allowed: true, msg: "Admin Mode" };

    // Device Lock
    if (user.bound_device === null) user.bound_device = deviceId;
    else if (user.bound_device !== deviceId) return { allowed: false, msg: "Locked to other device" };

    // Trial
    if (user.type === "TRIAL") {
        if (user.hands_left <= 0) return { allowed: false, msg: "Trial Ended" };
        return { allowed: true, msg: `Trial: ${user.hands_left}` };
    }

    // Paid
    if (user.type === "PAID") {
        const today = new Date();
        const expiry = new Date(user.expires);
        if (today > expiry) return { allowed: false, msg: "Expired" };
        const diff = Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));
        return { allowed: true, msg: `${diff} Days Left` };
    }
    return { allowed: false, msg: "Error" };
}

app.post('/api/verify', (req, res) => {
    const check = checkAccess(req.body.key, req.body.deviceId);
    res.json({ success: check.allowed, message: check.msg });
});

app.post('/api/predict', (req, res) => {
    const { history, key, deviceId } = req.body;
    
    // Security Check
    const check = checkAccess(key, deviceId);
    if (!check.allowed) return res.status(401).json({ error: check.msg });

    // Deduct Hand (Trial)
    if (USERS[key].type === "TRIAL" && USERS[key].type !== "ADMIN") USERS[key].hands_left--;

    // Execute Logic
    const prediction = getPrediction(history);

    res.json({
        success: true,
        prediction: prediction.pred,
        mode: prediction.mode,
        reason: prediction.reason,
        status: check.msg
    });
});

app.get('/api/reset', (req, res) => {
    if(USERS[req.query.key]) { USERS[req.query.key].bound_device = null; res.send("Reset"); }
});

app.get('/', (req, res) => res.send('V63 Secure Brain Active'));
app.listen(3000, () => console.log('✅ Server Running'));