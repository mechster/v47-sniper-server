// server.js - V58: Manual Business Server (Device Lock + Expiry)
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
app.use(cors());
app.use(bodyParser.json());

// =========================================================================
// 🔐 CUSTOMER DATABASE (MANUAL EDIT AREA)
// =========================================================================
// How to add a user:
// 1. TRIAL: { type: "TRIAL", hands_left: 200, active: true, bound_device: null }
// 2. PAID:  { type: "PAID",  expires: "YYYY-MM-DD", active: true, bound_device: null }

const USERS = {
    // --- ADMIN (You) ---
    "ADMIN-KEY":   { type: "ADMIN", active: true, bound_device: null },

    // --- TRIAL USERS (200 Hands ≈ 3 Shoes) ---
    "DEMO-USER":   { type: "TRIAL", hands_left: 200, active: true, bound_device: null },
    "TEST-123":    { type: "TRIAL", hands_left: 200, active: true, bound_device: null },

    // --- PAID USERS (YYYY-MM-DD) ---
    "VIP-JOHN":    { type: "PAID", expires: "2026-02-15", active: true, bound_device: null },
    "PRO-ALEX":    { type: "PAID", expires: "2026-12-31", active: true, bound_device: null }

    // PASTE NEW CUSTOMERS BELOW THIS LINE (Don't forget the comma!)
    
};
// =========================================================================

const STATIC_PATTERN = ['P','B','P','B','B','P','B','P','P','B','P','B'];

// --- 🧠 PREDICTION ENGINE ---
function getPrediction(history) {
    let streakCount = 0;
    let lastWinner = (history.length > 0) ? history[0] : null;
    
    // Calculate Streak
    if(lastWinner) {
        for(let i=0; i<history.length; i++) { 
            if(history[i] === lastWinner) streakCount++; 
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

    // 2. Dragon Logic
    if (streakCount >= 3) return { pred: lastWinner, mode: "DRAGON", reason: `Streak ${streakCount}` };

    // 3. Chop Logic
    if (history.length >= 3) {
        if (history[0] !== history[1] && history[1] !== history[2]) {
            return { pred: (history[0] === 'B' ? 'P' : 'B'), mode: "CHOP", reason: "Ping-Pong" };
        }
    }

    // 4. Static Fallback
    return { pred: STATIC_PATTERN[history.length % STATIC_PATTERN.length], mode: "STATIC", reason: "Base Pattern" };
}

// --- 🛡️ SECURITY CHECKER ---
function checkAccess(key, deviceId) {
    const user = USERS[key];
    
    // 1. Valid Key Check
    if (!user || !user.active) return { allowed: false, msg: "Invalid or Blocked Key" };

    // 2. Admin Bypass
    if (user.type === "ADMIN") return { allowed: true, msg: "Welcome Admin" };

    // 3. Device Locking
    if (user.bound_device === null) {
        user.bound_device = deviceId; // Lock to this phone
        console.log(`🔒 Key ${key} locked to ${deviceId}`);
    } else if (user.bound_device !== deviceId) {
        return { allowed: false, msg: "❌ Locked to another device" };
    }

    // 4. Trial Limits
    if (user.type === "TRIAL") {
        if (user.hands_left <= 0) return { allowed: false, msg: "Trial Ended. Please Buy." };
        // Only deduct on prediction, not login check
        return { allowed: true, msg: `Trial: ${user.hands_left} hands left` };
    }

    // 5. Date Expiry
    if (user.type === "PAID") {
        const today = new Date();
        const expiry = new Date(user.expires);
        if (today > expiry) return { allowed: false, msg: "Subscription Expired." };
        
        const diffTime = Math.abs(expiry - today);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
        return { allowed: true, msg: `${diffDays} Days Left` };
    }

    return { allowed: false, msg: "Error" };
}

// --- 🌐 API ROUTES ---

// 1. Verify Login (Does not deduct hands)
app.post('/api/verify', (req, res) => {
    const { key, deviceId } = req.body;
    const check = checkAccess(key, deviceId);
    res.json({ success: check.allowed, message: check.msg });
});

// 2. Get Prediction (Deducts hands for trial users)
app.post('/api/predict', (req, res) => {
    try {
        const { history, key, deviceId } = req.body;
        
        const check = checkAccess(key, deviceId);
        if (!check.allowed) return res.status(401).json({ error: check.msg, mode: "LOCKED" });

        // Deduct Hand for Trial User
        const user = USERS[key];
        if (user && user.type === "TRIAL" && user.type !== "ADMIN") {
            user.hands_left--;
        }

        if (!Array.isArray(history)) return res.status(400).json({ error: "Invalid Data" });

        const prediction = getPrediction(history);

        res.json({
            success: true,
            prediction: prediction.pred,
            mode: prediction.mode,
            reason: prediction.reason,
            status: check.msg // Updates UI with hands/days left
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Server Error" });
    }
});

// 3. Admin Reset (Unlock a user's device)
// Usage: https://your-url.onrender.com/api/reset?key=VIP-JOHN
app.get('/api/reset', (req, res) => {
    const keyToReset = req.query.key;
    if (USERS[keyToReset]) {
        USERS[keyToReset].bound_device = null;
        res.send(`✅ Device lock CLEARED for ${keyToReset}. They can now login on a new device.`);
    } else {
        res.send("❌ User not found.");
    }
});

// 4. Health Check
app.get('/', (req, res) => res.send('V58 Business Server Running 🚀'));

// --- START SERVER ---
const PORT = 3000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));