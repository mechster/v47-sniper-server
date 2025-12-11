// server.js - V55 Protected API
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
app.use(cors());
app.use(bodyParser.json());

// --- 🔐 LICENSE KEYS (EDIT THIS LIST TO ADD CUSTOMERS) ---
const VALID_KEYS = {
    "DEMO-123": true,       // Free Trial Key
    "VIP-PRO-2025": true,   // Paid User 1
    "ADMIN-KEY": true       // Your Key
};

// --- STRATEGY CONFIG ---
const STATIC_PATTERN = ['P','B','P','B','B','P','B','P','P','B','P','B'];

// --- CORE PREDICTION ENGINE ---
function getPrediction(history) {
    let streakCount = 0;
    let lastWinner = null;
    
    if (history.length > 0) {
        lastWinner = history[0];
        for (let i = 0; i < history.length; i++) {
            if (history[i] === lastWinner) streakCount++;
            else break;
        }
    }

    // 1. Cycle Logic
    for (let len = 3; len <= 6; len++) {
        if (history.length >= len * 2) {
            let isMatch = true;
            for (let i = 0; i < len; i++) {
                if (history[i] !== history[i + len]) { isMatch = false; break; }
            }
            if (isMatch) return { pred: history[len - 1], mode: `CYCLE-${len}`, reason: "Cycle Match" };
        }
    }

    // 2. Dragon
    if (streakCount >= 3) return { pred: lastWinner, mode: "DRAGON", reason: `Streak ${streakCount}` };

    // 3. Chop
    if (history.length >= 3) {
        if (history[0] !== history[1] && history[1] !== history[2]) {
            return { pred: (history[0] === 'B' ? 'P' : 'B'), mode: "CHOP", reason: "Ping-Pong" };
        }
    }

    // 4. Static
    let patternIdx = history.length % STATIC_PATTERN.length;
    return { pred: STATIC_PATTERN[patternIdx], mode: "STATIC", reason: "Base Pattern" };
}

// --- 🔑 VERIFICATION ENDPOINT ---
app.post('/api/verify', (req, res) => {
    const { key } = req.body;
    if (VALID_KEYS[key]) {
        res.json({ success: true, message: "Access Granted" });
    } else {
        res.json({ success: false, message: "Invalid or Expired Key" });
    }
});

// --- 🧠 PREDICTION ENDPOINT (PROTECTED) ---
app.post('/api/predict', (req, res) => {
    try {
        const { history, key } = req.body; // Client must send Key

        // SECURITY CHECK
        if (!VALID_KEYS[key]) {
            return res.status(401).json({ error: "ACCESS DENIED. Buy a key." });
        }
        
        if (!Array.isArray(history)) return res.status(400).json({ error: "Invalid Data" });

        const prediction = getPrediction(history);

        res.json({
            success: true,
            prediction: prediction.pred,
            mode: prediction.mode,
            reason: prediction.reason
        });

    } catch (error) {
        res.status(500).json({ error: "Server Error" });
    }
});

// --- KEEP ALIVE ---
app.get('/', (req, res) => res.send('V55 Secure Server Running'));

const PORT = 3000;
app.listen(PORT, () => console.log(`✅ Secure API running on port ${PORT}`));