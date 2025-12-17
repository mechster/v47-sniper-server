// server.js - V101: Pro V43 Logic Core
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
// 🧠 V101 (Pro V43) LOGIC ENGINE
// =========================================================================
const PATTERN_V43 = ['P','B','P','B','B','P','B','P','P','B','P','B'];

function getPrediction(history, isFlipped) {
    if (!Array.isArray(history) || history.length < 1) {
        return { pred: PATTERN_V43[0], mode: "INIT", reason: "Starting Sequence" };
    }

    let last = history[0]; 
    let rawPred = null;
    let mode = "PATTERN V43";
    let reason = "Base Sequence";

    // --- 1. DRAGON OVERRIDE (Priority 1) ---
    let streak = 0;
    for(let i=0; i<history.length; i++) { if(history[i] === last) streak++; else break; }
    
    if (streak >= 6) {
        return { pred: last, mode: "DRAGON", reason: `Streak ${streak} Override` };
    }

    // --- 2. DEEP MIRROR SEARCH (Priority 2) ---
    if (history.length >= 18) {
        let matches = 0; 
        let checks = 0;
        for(let i=0; i<6; i++) {
            if (history[i] && history[i+6] && history[i+12]) {
                if (history[i] === history[i+6] && history[i+6] === history[i+12]) matches++;
                checks++;
            }
        }
        if (checks >= 3 && matches >= checks - 1) {
            return { pred: history[5], mode: "MIRROR", reason: "18-Hand Cycle" };
        }
    }

    // --- 3. PATTERN FALLBACK ---
    let idx = history.length % PATTERN_V43.length;
    rawPred = PATTERN_V43[idx];

    // --- 4. FLIP LOGIC ---
    if (isFlipped) { 
        rawPred = (rawPred === 'B' ? 'P' : 'B');
        mode += " (FLIPPED)";
    }

    return { pred: rawPred, mode: mode, reason: reason };
}

// =========================================================================
// 🛡️ API
// =========================================================================
function checkAccess(key, deviceId) {
    if (!key) return { allowed: false, msg: "No Key" };
    const user = USERS[key];
    if (!user || !user.active) return { allowed: false, msg: "Invalid" };
    return { allowed: true, msg: "OK" };
}

app.post('/api/verify', (req, res) => {
    const check = checkAccess(req.body.key, req.body.deviceId);
    res.json({ success: check.allowed, message: check.msg });
});

app.post('/api/predict', (req, res) => {
    try {
        const { history = [], key, deviceId, isFlipped = false } = req.body;
        const check = checkAccess(key, deviceId);
        if (!check.allowed) return res.status(401).json({ error: check.msg });

        const result = getPrediction(history, isFlipped);
        res.json({ success: true, prediction: result.pred, mode: result.mode, reason: result.reason });
    } catch (e) {
        res.json({ success: true, prediction: "B", mode: "WAIT", reason: "Error" });
    }
});

app.get('/', (req, res) => res.send('V101 Server Active'));
app.listen(3000, () => console.log('✅ Server Active'));