// server.js - V86: Dynamic Scoring Engine
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
// 🧠 V86 LOGIC: DYNAMIC SCORING
// =========================================================================
// We test 4 strategies on the last 12 hands. Highest score wins.

function getVirtualPrediction(history, strategyType) {
    if (history.length < 3) return null;
    let last = history[0];
    
    if (strategyType === "DRAGON") {
        // Predict same as last
        return last;
    }
    if (strategyType === "PINGPONG") {
        // Predict opposite of last
        return (last === 'B' ? 'P' : 'B');
    }
    if (strategyType === "2-2") {
        // Pattern: A A B B ...
        // If A A B -> Predict B. 
        // If A B -> Predict B.
        // If A -> Predict A.
        // Implementation: Look at last 3.
        // B B P -> P
        // B P P -> B
        // P P B -> B
        if (history[0] === history[1]) return (last === 'B' ? 'P' : 'B'); // Switch after 2
        return last; // Stick if only 1
    }
    return null;
}

function getPrediction(history, lossStreak) {
    if (!Array.isArray(history) || history.length < 2) return { pred: 'B', mode: "WAIT", reason: "Gathering Data" };
    let lastResult = history[0];

    // --- 1. CRITICAL: AUTO-INVERSION ---
    // If we are wrong 2 times in a row, the current logic is out of sync.
    // Invert the trend immediately.
    if (lossStreak >= 2) {
        return { pred: lastResult, mode: "INVERT", reason: "Break Losing Streak" };
    }

    // --- 2. DYNAMIC SCORING (The V86 Brain) ---
    let scoreDragon = 0;
    let scorePingPong = 0;
    let score22 = 0;

    // Test the last 12 hands to see which logic would have won
    // We iterate backwards from index 0 to 11
    let limit = Math.min(history.length, 12);
    
    for (let i = 0; i < limit - 1; i++) {
        // We pretend we are at step 'i+1' trying to predict 'i'
        let actual = history[i];
        let pastSlice = history.slice(i + 1); // The history known at that moment

        if (getVirtualPrediction(pastSlice, "DRAGON") === actual) scoreDragon++;
        if (getVirtualPrediction(pastSlice, "PINGPONG") === actual) scorePingPong++;
        if (getVirtualPrediction(pastSlice, "2-2") === actual) score22++;
    }

    // --- 3. DECISION TIME ---
    // Select the strategy with the highest recent score
    let bestScore = Math.max(scoreDragon, scorePingPong, score22);
    
    // PRIORITY: DRAGON > 2-2 > PINGPONG (If tied)
    if (scoreDragon === bestScore && scoreDragon >= 2) {
        return { pred: lastResult, mode: "DRAGON", reason: `Score: ${scoreDragon}` };
    }
    if (score22 === bestScore && score22 >= 2) {
        let p22 = (history[0] === history[1]) ? (lastResult === 'B' ? 'P' : 'B') : lastResult;
        return { pred: p22, mode: "2-2 CYCLE", reason: `Score: ${score22}` };
    }
    if (scorePingPong === bestScore && scorePingPong >= 2) {
        let pPing = (lastResult === 'B' ? 'P' : 'B');
        return { pred: pPing, mode: "PING-PONG", reason: `Score: ${scorePingPong}` };
    }

    // --- 4. FALLBACK (If scores are low/zero) ---
    // Default to following the last result (Mini Streak)
    return { pred: lastResult, mode: "DEFAULT", reason: "Low Confidence" };
}

// =========================================================================
// 🛡️ API
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
        const { history = [], key, deviceId, lossStreak = 0 } = req.body;
        const check = checkAccess(key, deviceId);
        if (!check.allowed) return res.status(401).json({ error: check.msg });

        const result = getPrediction(history, lossStreak);
        res.json({ success: true, prediction: result.pred, mode: result.mode, reason: result.reason });
    } catch (e) {
        res.json({ success: true, prediction: "B", mode: "SAFE", reason: "Error" });
    }
});

app.get('/', (req, res) => res.send('V86 Dynamic Server'));
app.listen(3000, () => console.log('✅ Server Active'));