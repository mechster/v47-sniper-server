// server.js
// V47 Sniper API - The "Brain" in the Cloud

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
app.use(cors()); // Allows your HTML app to talk to this server
app.use(bodyParser.json());

// --- STRATEGY CONFIG ---
const STATIC_PATTERN = ['P','B','P','B','B','P','B','P','P','B','P','B'];

// --- CORE PREDICTION ENGINE ---
function getPrediction(history) {
    // history is an array of strings: ['P', 'B', 'B', 'P'...] (Newest first)
    
    // 1. ANALYZE STREAK & PATTERNS
    let streakCount = 0;
    let lastWinner = null;
    
    if (history.length > 0) {
        lastWinner = history[0];
        for (let i = 0; i < history.length; i++) {
            if (history[i] === lastWinner) streakCount++;
            else break;
        }
    }

    // 2. CHECK COMPLEX PATTERNS (Cycle Logic - Priority 1)
    // Checks for repeating cycles of length 3, 4, 5, 6 (e.g. P-P-B | P-P-B)
    for (let len = 3; len <= 6; len++) {
        if (history.length >= len * 2) {
            // Compare Current Cycle [0..len-1] with Previous Cycle [len..2len-1]
            let isMatch = true;
            for (let i = 0; i < len; i++) {
                if (history[i] !== history[i + len]) {
                    isMatch = false;
                    break;
                }
            }
            if (isMatch) {
                // If cycle matches, predict the next card in the sequence
                // The "next" card is the one that followed the previous cycle (history[len-1])
                return { 
                    pred: history[len - 1], 
                    mode: `CYCLE-${len}`, 
                    reason: `${len}-Hand Cycle Matched` 
                };
            }
        }
    }

    // 3. DRAGON LOGIC (Priority 2)
    if (streakCount >= 3) {
        return { 
            pred: lastWinner, 
            mode: "DRAGON", 
            reason: `Streak ${streakCount} Detected` 
        };
    }

    // 4. CHOP LOGIC (Priority 3)
    if (history.length >= 3) {
        // Check for P B P or B P B
        if (history[0] !== history[1] && history[1] !== history[2]) {
            return { 
                pred: (history[0] === 'B' ? 'P' : 'B'), 
                mode: "CHOP", 
                reason: "Ping-Pong Detected" 
            };
        }
    }

    // 5. STATIC FALLBACK (Priority 4)
    // Calculate pattern index based on total hands played
    let patternIdx = history.length % STATIC_PATTERN.length;
    let rawPred = STATIC_PATTERN[patternIdx];
    
    return { pred: rawPred, mode: "STATIC", reason: "Base Pattern" };
}
// --- KEEP-ALIVE ENDPOINT ---
app.get('/', (req, res) => {
    res.send('V47 Sniper is Awake and Running! 🚀');
});

// --- API ENDPOINT ---
app.post('/api/predict', (req, res) => {
    try {
        // 1. Get History from Client
        const { history } = req.body; 
        
        // Safety Check
        if (!Array.isArray(history)) {
            return res.status(400).json({ error: "Invalid history format. Send an array of winners." });
        }

        // 2. Run Logic
        const prediction = getPrediction(history);

        // 3. Send Result
        res.json({
            success: true,
            prediction: prediction.pred,
            mode: prediction.mode,
            reason: prediction.reason
        });

        // Optional: Log to server console to see it working
        console.log(`[Hand ${history.length}] Prediction: ${prediction.pred} (${prediction.mode})`);

    } catch (error) {
        console.error("Server Error:", error);
        res.status(500).json({ error: "Server Calculation Error" });
    }
});

// --- START SERVER ---
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`✅ V47 Sniper API is running on http://localhost:${PORT}`);
    console.log(`   - Server is listening for requests...`);
});