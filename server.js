// GENIE V115 SERVER - STRICT CHOP LOGIC
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
app.use(cors({ origin: '*' })); 
app.use(bodyParser.json());

// =========================================================================
// 🧠 LOGIC: CONSENSUS + STRICT CHOP GATE
// =========================================================================
const PATTERN_V43 = ['P','B','P','B','B','P','B','P','P','B','P','B'];

function getPrediction(history) {
    if (!Array.isArray(history) || history.length < 5) {
        return { pred: "B", mode: "CALIBRATING", reason: "Need 5 Hands" };
    }

    // 1. SCORING (Who is winning?)
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

    // 2. QUALIFICATION CHECKS
    // Rule: "GO CHOP ONLY AFTER PBP OR BPB"
    // We need h[0]!=h[1] AND h[1]!=h[2]
    let chopQualified = false;
    if (history.length >= 3) {
        if (history[0] !== history[1] && history[1] !== history[2]) {
            chopQualified = true;
        }
    }

    // 3. SELECT WINNER
    let bestScore = -1;
    let bestStrat = "TREND"; // Default fallback

    // Eval V43
    if (scores.v43 >= bestScore) { bestScore = scores.v43; bestStrat = "V43"; }
    
    // Eval Chop (ONLY IF QUALIFIED)
    if (chopQualified && scores.chop >= bestScore) { 
        bestScore = scores.chop; 
        bestStrat = "CHOP"; 
    }
    
    // Eval Trend
    if (scores.trend > bestScore) { 
        bestScore = scores.trend; 
        bestStrat = "TREND"; 
    } 

    // 4. GENERATE PREDICTION
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
app.get('/', (req, res) => res.send('✅ Genie V115 Strict Chop Active'));
app.post('/api/verify', (req, res) => res.json({ success: true, message: "Connected" }));

app.post('/api/predict', (req, res) => {
    try {
        const { history = [] } = req.body;
        const result = getPrediction(history);
        res.json({ success: true, prediction: result.pred, mode: result.mode, reason: result.reason });
    } catch (e) {
        res.json({ success: true, prediction: "B", mode: "CALIBRATING", reason: "Error" });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ SERVER RUNNING ON PORT ${PORT}`));