// server.js - V67: Deep Pattern Scanner & Ping-Pong Fix
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
    "ADMIN-KEY":   { type: "ADMIN", active: true, bound_device: null },
    "DEMO-USER":   { type: "TRIAL", hands_left: 200, active: true, bound_device: null },
    "DEMO-USER3":   { type: "TRIAL", hands_left: 100, active: true, bound_device: null },
    "DEMO-USER22":   { type: "TRIAL", hands_left: 100, active: true, bound_device: null },
    // Add your paid users here...
};

// =========================================================================
// 🧠 V67 PREDICTION ENGINE (The New Logic)
// =========================================================================

const STATIC_PATTERN = ['P','B','P','B','B','P','B','P','P','B','P','B'];

function getPrediction(history) {
    // 0. Safety Check
    if (history.length < 1) return { pred: STATIC_PATTERN[0], mode: "WAIT", reason: "Need Data" };

    let lastResult = history[0]; // Newest hand
    
    // ---------------------------------------------------------
    // 1. DRAGON / STREAK DETECTION (Highest Priority)
    // "And also dont miss streaks"
    // ---------------------------------------------------------
    let streakCount = 0;
    for(let i=0; i<history.length; i++) {
        if(history[i] === lastResult) streakCount++;
        else break;
    }

    // If streak is 4 or more, RIDE THE DRAGON.
    if (streakCount >= 4) {
        return { pred: lastResult, mode: "DRAGON", reason: `Streak ${streakCount}` };
    }

    // ---------------------------------------------------------
    // 2. DEEP PATTERN SCANNER (The User's List)
    // Scans for cycles: 2-2 (Len 4), 3-3 (Len 6), 4-4 (Len 8), 6-6 (Len 12)
    // Also scans for 2-1 (Len 3)
    // ---------------------------------------------------------
    
    // We check cycle lengths in specific order of complexity
    const cycleLengths = [12, 8, 6, 4, 3]; 

    for (let len of cycleLengths) {
        // We need at least 2 full cycles to confirm a pattern
        // e.g. for 2-2 (len 4), we need 8 hands: PPBB PPBB
        if (history.length >= len * 2) {
            let isMatch = true;
            // Check if the recent 'len' hands match the previous 'len' hands
            for (let i = 0; i < len; i++) {
                if (history[i] !== history[i + len]) {
                    isMatch = false;
                    break;
                }
            }
            
            if (isMatch) {
                // If matched, predict the next step in the cycle
                // The "next" step is exactly what happened 'len' hands ago (at index len-1)
                let nextPred = history[len - 1]; 
                
                let name = "PATTERN";
                if(len === 3) name = "2-1 CYCLE";
                if(len === 4) name = "2-2 CYCLE";
                if(len === 6) name = "3-3 CYCLE";
                if(len === 8) name = "4-4 CYCLE";
                if(len === 12) name = "6-6 CYCLE";

                return { pred: nextPred, mode: name, reason: `Repeating ${len}` };
            }
        }
    }

    // ---------------------------------------------------------
    // 3. PING PONG (CHOP) DETECTION
    // Fixes "Predicting opposite of pingpong"
    // ---------------------------------------------------------
    if (history.length >= 2) {
        // If last 2 were different (e.g., B P)
        if (history[0] !== history[1]) {
            // Check if it's a sustained chop (e.g., P B P)
            if (history.length >= 3 && history[1] !== history[2]) {
                // We have P B P (or B P B).
                // Predict the OPPOSITE of the last hand to continue the Chop.
                let nextPred = (lastResult === 'B' ? 'P' : 'B');
                return { pred: nextPred, mode: "PING-PONG", reason: "Chop Detected" };
            }
        }
    }

    // ---------------------------------------------------------
    // 4. STATIC BACKUP
    // If no pattern found, use V24 Base
    // ---------------------------------------------------------
    let idx = history.length % STATIC_PATTERN.length;
    return { pred: STATIC_PATTERN[idx], mode: "STATIC", reason: "Base Strategy" };
}

// =========================================================================
// 🛡️ API HANDLERS (Standard Security)
// =========================================================================

function checkAccess(key, deviceId) {
    const user = USERS[key];
    if (!user || !user.active) return { allowed: false, msg: "Invalid Key" };
    if (user.type === "ADMIN") return { allowed: true, msg: "Admin" };

    if (user.bound_device === null) user.bound_device = deviceId;
    else if (user.bound_device !== deviceId) return { allowed: false, msg: "Device Locked" };

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

    // Deduct Trial Hand
    if (USERS[key].type === "TRIAL" && USERS[key].type !== "ADMIN") {
        USERS[key].hands_left--;
    }

    const result = getPrediction(history);

    res.json({
        success: true,
        prediction: result.pred,
        mode: result.mode,
        reason: result.reason,
        status: check.msg
    });
});

app.get('/', (req, res) => res.send('V67 Pattern Engine Running'));

app.listen(3000, () => console.log('✅ Server Active'));

