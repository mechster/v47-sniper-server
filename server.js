// server.js - V108 Cloud Edition
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
app.use(cors()); // Allows your phone to talk to this server
app.use(bodyParser.json());

// =========================================================================
// 🧠 LOGIC: FORCED CONSENSUS (V106)
// =========================================================================
const PATTERN_V43 = ['P','B','P','B','B','P','B','P','P','B','P','B'];

function getPrediction(history) {
    if (!Array.isArray(history) || history.length < 5) {
        return { pred: "B", mode: "CALIBRATING", reason: "Need 5 Hands" };
    }

    let scores = { trend: 0, chop: 0, v43: 0 };
    let lookback = Math.min(history.length - 1, 6); 
    
    for (let i = 0; i < lookback; i++) {
        let actual = history[i];
        let prev = history[i+1];

        if (prev === actual) scores.trend++;
        let opp = (prev === 'B' ? 'P' : 'B');
        if (opp === actual) scores.chop++;

        let pIdx = (history.length - 1 - i) % PATTERN_V43.length;
        if (PATTERN_V43[pIdx] === actual) scores.v43++;
    }

    let bestScore = -1;
    let bestStrat = "TREND"; 

    if (scores.v43 >= bestScore) { bestScore = scores.v43; bestStrat = "V43"; }
    if (scores.chop >= bestScore) { bestScore = scores.chop; bestStrat = "CHOP"; }
    if (scores.trend > bestScore) { bestScore = scores.trend; bestStrat = "TREND"; } 

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

// API Routes
app.post('/api/verify', (req, res) => res.json({ success: true, message: "Cloud Active" }));

app.post('/api/predict', (req, res) => {
    try {
        const { history = [] } = req.body;
        const result = getPrediction(history);
        res.json({ success: true, prediction: result.pred, mode: result.mode, reason: result.reason });
    } catch (e) {
        res.json({ success: true, prediction: "B", mode: "CALIBRATING", reason: "Error" });
    }
});

// Cloud Port Listener (Required for Glitch/Render)
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Cloud Server Active on Port ${PORT}`));