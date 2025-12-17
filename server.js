// server.js - V105: Always Action (No Wait)
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
app.use(cors());
app.use(bodyParser.json());

// =========================================================================
// 🧠 V105 LOGIC: FORCED CONSENSUS
// =========================================================================
const PATTERN_V43 = ['P','B','P','B','B','P','B','P','P','B','P','B'];

function getPrediction(history) {
    // We only need 5 hands to calculate the first score.
    if (!Array.isArray(history) || history.length < 5) {
        return { pred: "B", mode: "CALIBRATING", reason: "Need 5 Hands" };
    }

    // 1. SCORING SYSTEM (Last 6 Hands)
    let scores = { trend: 0, chop: 0, v43: 0 };
    let lookback = Math.min(history.length - 1, 6); 
    
    for (let i = 0; i < lookback; i++) {
        let actual = history[i];
        let prev = history[i+1];

        // Trend (P->P)
        if (prev === actual) scores.trend++;

        // Chop (P->B)
        let opp = (prev === 'B' ? 'P' : 'B');
        if (opp === actual) scores.chop++;

        // V43 Pattern
        let pIdx = (history.length - 1 - i) % PATTERN_V43.length;
        if (PATTERN_V43[pIdx] === actual) scores.v43++;
    }

    // 2. SELECT WINNER (Forced)
    // We do NOT check if score > 3. We just pick the highest.
    let bestScore = -1;
    let bestStrat = "TREND"; // Default fallback

    if (scores.v43 >= bestScore) { bestScore = scores.v43; bestStrat = "V43"; }
    if (scores.chop >= bestScore) { bestScore = scores.chop; bestStrat = "CHOP"; }
    if (scores.trend > bestScore) { bestScore = scores.trend; bestStrat = "TREND"; } 
    // Note: Ties favor Trend -> Chop -> V43 based on order above

    // 3. GENERATE PREDICTION
    let last = history[0];
    let finalPred = null;
    
    if (bestStrat === "TREND") {
        finalPred = last;
    } else if (bestStrat === "CHOP") {
        finalPred = (last === 'B' ? 'P' : 'B');
    } else {
        let nextIdx = history.length % PATTERN_V43.length;
        finalPred = PATTERN_V43[nextIdx];
    }

    return { 
        pred: finalPred, 
        mode: bestStrat, 
        reason: `Score: ${bestScore}/6` 
    };
}

// =========================================================================
// 🛡️ API
// =========================================================================
function checkAccess(key, deviceId) {
    if (!key) return { allowed: false, msg: "No Key" };
    return { allowed: true, msg: "OK" };
}

app.post('/api/verify', (req, res) => {
    res.json({ success: true, message: "OK" });
});

app.post('/api/predict', (req, res) => {
    try {
        const { history = [] } = req.body;
        const result = getPrediction(history);
        res.json({ success: true, prediction: result.pred, mode: result.mode, reason: result.reason });
    } catch (e) {
        res.json({ success: true, prediction: "B", mode: "CALIBRATING", reason: "Error" });
    }
});

app.get('/', (req, res) => res.send('V105 Action Engine Active'));
app.listen(3000, () => console.log('✅ Server Active'));