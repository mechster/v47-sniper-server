// GENIE V120 SERVER - PATTERN MASTER
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
app.use(cors({ origin: '*' })); 
app.use(bodyParser.json());

function getPrediction(rawHistory) {
    // 1. FILTER TIES
    const history = rawHistory.filter(h => h !== 'T');

    if (!Array.isArray(history) || history.length < 3) {
        return { pred: "B", mode: "CALIBRATING", reason: "Need Data" };
    }

    let last = history[0]; // Recent result

    // 2. CALCULATE CURRENT STREAK
    let currentStreak = 0;
    for(let i=0; i<history.length; i++) {
        if(history[i] === last) currentStreak++; else break;
    }

    // 3. V120 PATTERN LOGIC
    let finalPred = null;
    let mode = "";
    let reason = "";

    if (currentStreak === 1) {
        // PATTERN: CHOP or START OF 2
        // Rule: Bet Opposite.
        // Catches: P B P B (Chop)
        finalPred = (last === 'B' ? 'P' : 'B');
        mode = "CHOP / 1-2";
        reason = "Anticipating Change";
    } 
    else if (currentStreak === 2) {
        // PATTERN: 2-1 or 2-2
        // Rule: Bet Opposite.
        // Catches: B B P (2-1) or B B P P (2-2)
        finalPred = (last === 'B' ? 'P' : 'B');
        mode = "PATTERN 2-2";
        reason = "Cutting the Pair";
    }
    else if (currentStreak >= 3) {
        // PATTERN: STREAK / 3-1 / 4-1
        // Rule: Bet Same (Ride).
        // If it was going to be 2-1, we would have won on step 2.
        // Since it's 3, it's likely a streak or a deeper pattern (3-1).
        // We bet WITH the streak now.
        finalPred = last;
        mode = "STREAK RIDE";
        reason = `Riding Streak ${currentStreak}`;
    }

    return { 
        pred: finalPred, 
        mode: mode, 
        reason: reason,
        isFlat: (currentStreak >= 4) // Safety: Flat bet deep streaks
    };
}

// API Routes
app.get('/', (req, res) => res.send('✅ Genie V120 Pattern Master Active'));
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