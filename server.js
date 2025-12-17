// server.js - V103: Consensus Engine
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
app.use(cors());
app.use(bodyParser.json());

// =========================================================================
// 🧠 V103 LOGIC: DYNAMIC SCORING (ADAPTIVE)
// =========================================================================
const PATTERN_V43 = ['P','B','P','B','B','P','B','P','P','B','P','B'];

function getPrediction(history) {
    if (!Array.isArray(history) || history.length < 5) {
        return { pred: "B", mode: "CALIBRATING", reason: "Need 5 Hands" };
    }

    // 1. SCORING SYSTEM
    // We simulate the last 6 hands to see which strategy IS winning right now.
    let scores = {
        trend: 0,  // Strategy A: Follow the winner (P->P)
        chop: 0,   // Strategy B: Oppose the winner (P->B)
        v43: 0     // Strategy C: Fixed V43 Sequence
    };

    let lookback = Math.min(history.length - 1, 6); 
    
    for (let i = 0; i < lookback; i++) {
        let targetIndex = i; // 0 is newest
        let prevIndex = i + 1; 
        
        let actual = history[targetIndex];
        let prev = history[prevIndex];

        // Score Trend
        if (prev === actual) scores.trend++;

        // Score Chop
        let opp = (prev === 'B' ? 'P' : 'B');
        if (opp === actual) scores.chop++;

        // Score V43
        // Calculate index of V43 for that specific historical hand
        let pIdx = (history.length - 1 - i) % PATTERN_V43.length;
        if (PATTERN_V43[pIdx] === actual) scores.v43++;
    }

    // 2. SELECT WINNER
    let bestScore = -1;
    let bestStrat = null;
    let finalPred = null;

    // Compare
    if (scores.trend > bestScore) { bestScore = scores.trend; bestStrat = "TREND"; }
    if (scores.chop > bestScore) { bestScore = scores.chop; bestStrat = "CHOP"; } // Chop priority on tie
    if (scores.v43 > bestScore) { bestScore = scores.v43; bestStrat = "V43"; }

    // 3. GENERATE PREDICTION
    let last = history[0];
    
    if (bestStrat === "TREND") {
        finalPred = last;
    } else if (bestStrat === "CHOP") {
        finalPred = (last === 'B' ? 'P' : 'B');
    } else {
        let nextIdx = history.length % PATTERN_V43.length;
        finalPred = PATTERN_V43[nextIdx];
    }

    // 4. ADAPTATION FILTER
    // If the best strategy is barely winning (<=50%), the table is Chaos. WAIT.
    if (bestScore <= 3) {
        return { pred: finalPred, mode: "WAIT", reason: "Low Accuracy (<50%)" };
    }

    return { 
        pred: finalPred, 
        mode: bestStrat, 
        reason: `Confidence: ${Math.round((bestScore/6)*100)}%` 
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
        res.json({ success: true, prediction: "B", mode: "WAIT", reason: "Error" });
    }
});

app.get('/', (req, res) => res.send('V103 Fibonacci Consensus Active'));
app.listen(3000, () => console.log('✅ Server Active'));