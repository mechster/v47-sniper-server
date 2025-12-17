// GENIE V117 SERVER - TACTICAL STREAK
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

    // 2. SCORING SYSTEM (Who is winning?)
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

    // 3. SELECT BASE STRATEGY
    let bestScore = -1;
    let bestStrat = "TREND"; 

    // Default Priority: Trend > Chop > V43
    if (scores.v43 >= bestScore) { bestScore = scores.v43; bestStrat = "V43"; }
    if (scores.chop >= bestScore) { bestScore = scores.chop; bestStrat = "CHOP"; }
    if (scores.trend > bestScore) { bestScore = scores.trend; bestStrat = "TREND"; } 

    // 4. APPLY "TACTICAL STREAK" OVERRIDES
    let finalPred = null;
    let mode = bestStrat;
    let forceFlat = false;

    if (bestStrat === "TREND") {
        // Rule: "Stop catching streak after 2nd hand"
        // Rule: "Catch streak after 4th hand"
        // Rule: "Only go streak in flat bets"
        
        if (streak === 1) {
            // Normal Trend (Betting for 2nd)
            finalPred = last;
        } 
        else if (streak === 2 || streak === 3) {
            // PAUSE ZONE
            // We do NOT bet trend here. We look for alternatives.
            if (scores.chop >= 3) {
                mode = "CHOP (ANTI-STREAK)";
                finalPred = (last === 'B' ? 'P' : 'B');
            } else if (scores.v43 >= 3) {
                mode = "V43 (ANTI-STREAK)";
                let nextIdx = history.length % PATTERN_V43.length;
                finalPred = PATTERN_V43[nextIdx];
            } else {
                // No good alternative? WAIT.
                return { pred: last, mode: "WAIT", reason: `Streak ${streak} Pause` };
            }
        } 
        else if (streak >= 4) {
            // RESUME ZONE (Dragon Catch)
            finalPred = last;
            mode = "DRAGON (FLAT)";
            forceFlat = true; // Tell client to use flat bet
        }
    } 
    else if (bestStrat === "CHOP") {
        finalPred = (last === 'B' ? 'P' : 'B');
    } 
    else {
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
app.get('/', (req, res) => res.send('✅ Genie V117 Tactical Active'));
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
            isFlat: result.isFlat // Send Flat Bet Flag
        });
    } catch (e) {
        res.json({ success: true, prediction: "B", mode: "CALIBRATING", reason: "Error" });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ SERVER RUNNING ON PORT ${PORT}`));