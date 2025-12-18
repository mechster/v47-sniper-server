// GENIE V118 SERVER - HARD PAUSE
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
app.use(cors({ origin: '*' })); 
app.use(bodyParser.json());

const PATTERN_V43 = ['P','B','P','B','B','P','B','P','P','B','P','B'];

function getPrediction(history) {
    if (!Array.isArray(history) || history.length < 5) {
        return { pred: "B", mode: "CALIBRATING", reason: "Need 5 Hands" };
    }

    let last = history[0];

    // 1. CALCULATE CURRENT STREAK
    let streak = 0;
    for(let i=0; i<history.length; i++) {
        if(history[i] === last) streak++; else break;
    }

    // 2. SCORING SYSTEM
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

    // 3. SELECT STRATEGY
    let bestScore = -1;
    let bestStrat = "TREND"; 

    if (scores.v43 >= bestScore) { bestScore = scores.v43; bestStrat = "V43"; }
    if (scores.chop >= bestScore) { bestScore = scores.chop; bestStrat = "CHOP"; }
    if (scores.trend > bestScore) { bestScore = scores.trend; bestStrat = "TREND"; } 

    // 4. APPLY "HARD PAUSE" RULES
    let finalPred = null;
    let mode = bestStrat;
    let forceFlat = false;

    if (bestStrat === "TREND") {
        if (streak === 1) {
            // Normal Trend: Bet to catch 2nd
            finalPred = last;
        } 
        else if (streak === 2 || streak === 3) {
            // *** V118 FIX: HARD WAIT ***
            // Do NOT try to guess Chop here. Just stop.
            return { 
                pred: last, // Placeholder
                mode: "WAIT", 
                reason: `Streak ${streak}: Observing...` 
            };
        } 
        else if (streak >= 4) {
            // Resume on 5th Hand (Streak 4)
            finalPred = last;
            mode = "DRAGON (FLAT)";
            forceFlat = true; 
        }
    } 
    else if (bestStrat === "CHOP") {
        // Only bet chop if NO streak exists (Streak 1 max)
        if (streak > 1) {
             return { pred: last, mode: "WAIT", reason: "Chop Risky (Streak)" };
        }
        finalPred = (last === 'B' ? 'P' : 'B');
    } 
    else {
        // V43 Pattern
        let nextIdx = history.length % PATTERN_V43.length;
        finalPred = PATTERN_V43[nextIdx];
    }

    return { 
        pred: finalPred, 
        mode: mode, 
        reason: `Score: ${bestScore}/6`,
        isFlat: forceFlat
    };
}

// API Routes
app.get('/', (req, res) => res.send('✅ Genie V118 Hard Pause Active'));
app.post('/api/verify', (req, res) => res.json({ success: true, message: "Connected" }));

app.post('/api/predict', (req, res) => {
    try {
        const { history = [] } = req.body;
        const result = getPrediction(history);
        res.json({ 
            success: true, 
            prediction: result.pred, 
            mode: result.mode, 
            reason: result.reason,
            isFlat: result.isFlat
        });
    } catch (e) {
        res.json({ success: true, prediction: "B", mode: "CALIBRATING", reason: "Error" });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ SERVER RUNNING ON PORT ${PORT}`));