// server.js - V100: Pattern Lock V45 Logic
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
// 🧠 V100 LOGIC ENGINE (Derived from V45)
// =========================================================================
const STATIC_PATTERN = ['P','B','P','B','B','P','B','P','P','B','P','B'];

function getPrediction(history, lossStreak, isObserve) {
    if (!Array.isArray(history) || history.length < 1) {
        return { pred: STATIC_PATTERN[0], mode: "INIT", reason: "Starting Sequence" };
    }

    let lastResult = history[0]; // Newest hand
    
    // --- 0. CALCULATE STREAK ---
    let streak = 0;
    for(let i=0; i<history.length; i++) { 
        if(history[i] === lastResult) streak++; else break; 
    }

    // --- 1. DRAGON RIDER (Streak >= 3) ---
    // "If we see A A A, we assume A A A A."
    if (streak >= 3) {
        return { pred: lastResult, mode: "DRAGON", reason: `Streak ${streak} Detected` };
    }

    // --- 2. 2-2 GLUE (The "Twin" Pattern) ---
    // Checks for A B B A pattern in last 4 hands.
    // Hist: [A(0), B(1), B(2), A(3)] -> Next likely A.
    // Logic: h[0] != h[1], h[1] == h[2], h[0] == h[3]
    if (history.length >= 4) {
        if (history[0] !== history[1] && history[1] === history[2] && history[0] === history[3]) {
            return { pred: history[0], mode: "2-2 LOCK", reason: "2-2 Continuation" };
        }
    }

    // --- 3. 2-1 ASSASSIN (The "P P B" Pattern) ---
    // Checks for A A B pattern.
    // Hist: [B(0), A(1), A(2)]. Next likely B.
    if (history.length >= 3) {
        if (history[0] !== history[1] && history[1] === history[2]) {
            return { pred: history[0], mode: "2-X LOCK", reason: "Expecting Pair/Alt" };
        }
    }

    // --- 4. CHOP RIDER (P B P B) ---
    if (history.length >= 3) {
        if (history[0] !== history[1] && history[1] !== history[2]) {
            let next = (history[0] === 'B' ? 'P' : 'B');
            return { pred: next, mode: "CHOP", reason: "Ping-Pong Detected" };
        }
    }

    // --- 5. STATIC FALLBACK (With Inversion) ---
    let idx = history.length % STATIC_PATTERN.length;
    let rawPred = STATIC_PATTERN[idx];

    // Invert if 2+ consecutive losses and NOT in virtual mode
    // (Note: Client sends lossStreak. If isObserve is true, client might handle it, 
    // but the logic file says "&& !isObserve". We rely on client flag 'isObserve' passed in)
    if (lossStreak >= 2 && !isObserve) {
        rawPred = (rawPred === 'B' ? 'P' : 'B');
        return { pred: rawPred, mode: "STATIC-INV", reason: "Pattern Inverted" };
    }

    return { pred: rawPred, mode: "STATIC", reason: "Base Pattern" };
}

// =========================================================================
// 🛡️ API HANDLERS
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
        const { history = [], key, deviceId, lossStreak = 0, isObserve = false } = req.body;
        const check = checkAccess(key, deviceId);
        if (!check.allowed) return res.status(401).json({ error: check.msg });

        const result = getPrediction(history, lossStreak, isObserve);
        res.json({ success: true, prediction: result.pred, mode: result.mode, reason: result.reason });
    } catch (e) {
        res.json({ success: true, prediction: "B", mode: "WAIT", reason: "Error" });
    }
});

app.get('/', (req, res) => res.send('V100 Pattern Lock Active'));
app.listen(3000, () => console.log('✅ Server Active'));