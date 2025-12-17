// GENIE V110 SERVER - FINAL UNIVERSAL
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();

// 1. CRITICAL: ALLOW ALL CONNECTIONS (Fixes "Data Not Feeding")
app.use(cors({ origin: '*' })); 
app.use(bodyParser.json());

// =========================================================================
// 🧠 LOGIC: CONSENSUS ENGINE (V106)
// =========================================================================
const PATTERN_V43 = ['P','B','P','B','B','P','B','P','P','B','P','B'];

function getPrediction(history) {
    // Need 5 hands to calibrate, otherwise safe default
    if (!Array.isArray(history) || history.length < 5) {
        return { pred: "B", mode: "CALIBRATING", reason: "Need 5 Hands" };
    }

    let scores = { trend: 0, chop: 0, v43: 0 };
    // Look at last 6 hands to find the winning strategy
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

    // Select Winner (Priority: Trend > Chop > V43)
    let bestScore = -1;
    let bestStrat = "TREND"; 

    if (scores.v43 >= bestScore) { bestScore = scores.v43; bestStrat = "V43"; }
    if (scores.chop >= bestScore) { bestScore = scores.chop; bestStrat = "CHOP"; }
    if (scores.trend > bestScore) { bestScore = scores.trend; bestStrat = "TREND"; } 

    // Generate Prediction
    let last = history[0];
    let finalPred = null;
    
    if (bestStrat === "TREND") finalPred = last;
    else if (bestStrat === "CHOP") finalPred = (last === 'B' ? 'P' : 'B');
    else {
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
// 🛡️ API ROUTES
// =========================================================================
app.get('/', (req, res) => res.send('✅ Genie V110 Brain Active'));

app.post('/api/verify', (req, res) => {
    // Simple handshake
    res.json({ success: true, message: "Connected" });
});

app.post('/api/predict', (req, res) => {
    try {
        const { history = [] } = req.body;
        const result = getPrediction(history);
        res.json({ success: true, prediction: result.pred, mode: result.mode, reason: result.reason });
    } catch (e) {
        console.error("Logic Error:", e);
        res.json({ success: true, prediction: "B", mode: "CALIBRATING", reason: "Error" });
    }
});

// Start Server (Auto-detects Port)
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ SERVER RUNNING ON PORT ${PORT}`));