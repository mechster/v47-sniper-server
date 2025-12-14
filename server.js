// server.js - V80: Pure V47 Logic Port
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
// 🧠 V80 LOGIC: THE V47 ENGINE
// =========================================================================
const STATIC_SEQUENCE = ['P','B','P','B','B','P','B','P','P','B','P','B'];

function getPrediction(history, lossStreak) {
    // 0. Safety
    if (history.length < 1) return { pred: STATIC_SEQUENCE[0], mode: "WAIT" };
    let lastResult = history[0]; 

    // --- PRIORITY 1: CYCLE MATCHING (Lengths 3 to 6) ---
    // Scans for complex repeating patterns (e.g. PPB, PPPB)
    // As defined in V47: Compare [0..len-1] with [len..2len-1]
    for (let len = 3; len <= 6; len++) {
        if (history.length >= len * 2) {
            let isMatch = true;
            for (let i = 0; i < len; i++) {
                if (history[i] !== history[i + len]) {
                    isMatch = false;
                    break;
                }
            }
            if (isMatch) {
                // If cycle matches, predict the next expected hand in that cycle.
                // In V47 logic, this corresponds to history[len-1].
                return { pred: history[len-1], mode: `CYCLE-${len}`, reason: `${len}-Hand Cycle` };
            }
        }
    }

    // --- PRIORITY 2: DRAGON RIDER ---
    // If streak >= 3, ride it.
    let streakCount = 0;
    for(let i=0; i<history.length; i++) { 
        if(history[i] === lastResult) streakCount++; else break; 
    }
    if (streakCount >= 3) {
        return { pred: lastResult, mode: "DRAGON", reason: `Streak ${streakCount}` };
    }

    // --- PRIORITY 3: CHOP RIDER ---
    // If history is P B P (or B P B), predict chop continues.
    if (history.length >= 3) {
        if (history[0] !== history[1] && history[1] !== history[2]) {
            let next = (history[0] === 'B' ? 'P' : 'B');
            return { pred: next, mode: "CHOP", reason: "Ping-Pong" };
        }
    }

    // --- PRIORITY 4: STATIC FALLBACK (With V47 Inversion) ---
    let idx = history.length % STATIC_SEQUENCE.length;
    let basePred = STATIC_SEQUENCE[idx];
    
    // V47 Rule: If 2 or more consecutive losses, INVERT the static pattern.
    // This tries to break a losing streak against the static logic.
    if (lossStreak >= 2) {
        basePred = (basePred === 'B' ? 'P' : 'B');
        return { pred: basePred, mode: "STATIC-INV", reason: "Inverted Pattern" };
    }

    return { pred: basePred, mode: "STATIC", reason: "Base Sequence" };
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
    if (user.type === "TRIAL") {
        if (user.hands_left <= 0) return { allowed: false, msg: "Trial Ended" };
    }
    return { allowed: true, msg: "OK" };
}

app.post('/api/verify', (req, res) => {
    const check = checkAccess(req.body.key, req.body.deviceId);
    res.json({ success: check.allowed, message: check.msg });
});

app.post('/api/predict', (req, res) => {
    // We now accept lossStreak from the client to handle the "Inversion" logic
    const { history, key, deviceId, lossStreak } = req.body;
    const check = checkAccess(key, deviceId);
    
    if (!check.allowed) return res.status(401).json({ error: check.msg });

    if (USERS[key].type === "TRIAL" && USERS[key].type !== "ADMIN") {
        USERS[key].hands_left--;
    }

    const result = getPrediction(history, lossStreak || 0);

    res.json({
        success: true,
        prediction: result.pred,
        mode: result.mode,
        reason: result.reason,
        status: check.msg
    });
});

app.get('/', (req, res) => res.send('V80 V47-Logic Server Active'));
app.listen(3000, () => console.log('✅ Server Active'));