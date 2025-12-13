// server.js - V72: Pure PatternV24 + Streak Logic
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
// 🧠 V72 "IRON-CLAD" LOGIC
// =========================================================================
// The "Master Key" Pattern you requested
const PATTERNV24 = ['P','B','P','B','B','P','B','P','P','B','P','B'];

function getPrediction(history) {
    // 0. Initial Safety
    if (history.length < 1) return { pred: PATTERNV24[0], mode: "WAIT", reason: "Need Data" };
    let lastResult = history[0]; 

    // --- 1. STREAK CATCHER (Highest Priority) ---
    // If we see 3 or more of the same color, we MUST bet for it to continue.
    // We do not want to miss a Dragon.
    let streakCount = 0;
    for(let i=0; i<history.length; i++) { 
        if(history[i] === lastResult) streakCount++; else break; 
    }

    if (streakCount >= 3) {
        return { pred: lastResult, mode: "DRAGON", reason: `Streak ${streakCount}` };
    }

    // --- 2. DEEP CYCLE SCANNER ---
    // Scans for repetitive cycles (2-2, 3-3, 2-1, etc.)
    // We check lengths: 12 (Full), 8 (4-4), 6 (3-3), 4 (2-2), 3 (2-1)
    const cycles = [12, 8, 6, 4, 3];

    for (let len of cycles) {
        // Need at least 2 full cycles to confirm (e.g., 8 hands for a len-4 cycle)
        if (history.length >= len * 2) {
            let isMatch = true;
            // Compare the last 'len' hands with the 'len' hands before them
            for (let i = 0; i < len; i++) {
                if (history[i] !== history[i + len]) {
                    isMatch = false;
                    break;
                }
            }
            
            if (isMatch) {
                // If the cycle repeats, the next prediction is what happened 'len' hands ago
                let nextPred = history[len - 1]; 
                let label = `CYCLE ${len}`;
                if(len===4) label = "2-2 CYCLE";
                if(len===3) label = "2-1 CYCLE";
                
                return { pred: nextPred, mode: label, reason: `Repeating ${len}` };
            }
        }
    }

    // --- 3. PATTERNV24 (The Backup) ---
    // If no Dragon and no clear Cycle, we stick to the script.
    let idx = history.length % PATTERNV24.length;
    let basePred = PATTERNV24[idx];

    return { pred: basePred, mode: "PATTERN V24", reason: "Master Strategy" };
}

// =========================================================================
// 🛡️ API HANDLERS
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

app.get('/api/reset', (req, res) => {
    if(USERS[req.query.key]) { USERS[req.query.key].bound_device = null; res.send("Reset OK"); }
});

app.get('/', (req, res) => res.send('V72 PatternV24 Server Active'));
app.listen(3000, () => console.log('✅ Server Active'));