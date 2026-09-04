///////////////////////////////////////////
// User authentication and authorization //
///////////////////////////////////////////
const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../db/database');
const router = express.Router();
const SECRET = process.env.JWT_SECRET;
const rateLimit = require('express-rate-limit');
const { validateUsername } = require('../utils/validate');
const { ipKeyGenerator } = rateLimit;

// Simple self-hosted captcha
function generateCaptcha() {
    const a = Math.floor(Math.random() * 20) + 1;
    const b = Math.floor(Math.random() * 20) + 1;
    const useSubtraction = Math.random() < 0.5 && a >= b;
    if (useSubtraction) {
        return { question: `${a} - ${b}`, answer: a - b };
    }
    return { question: `${a} + ${b}`, answer: a + b };
}

// Rate Limiter
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    keyGenerator: (req) => req.body.username || ipKeyGenerator(req), // fixed casing + IPv6-safe helper
    message: { error: "Too many attempts, please try again later" }
});

// Helper function to create token and set it as cookie
function issueToken(res, user) {
    const token = jwt.sign(
        { id: user.id, username: user.username },
        SECRET,
        { expiresIn: "7d" }
    );

    res.cookie('token', token, {
        httpOnly: true,
        maxAge: 7 * 24 * 60 * 60 * 1000,
        samesite: 'lax',
    });
}

// POST /api/register
router.post('/register', authLimiter, async (req, res) => {
    const { username, password, captchaToken, captchaAnswer } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: "Username and password are required" });
    };
    if (!captchaToken || captchaAnswer === undefined || captchaAnswer === null || captchaAnswer === "") {
        return res.status(400).json({ error: "Please answer the verification question" });
    };

    try {
        const captchaPayload = jwt.verify(captchaToken, SECRET);
        if (Number(captchaAnswer) !== captchaPayload.answer) {
            return res.status(400).json({ error: "Incorrect captcha answer" });
        }
    } catch {
        return res.status(401).json({ error: "Captcha verification expired" }); // 401 → auth failure
    };

    if (username.length < 3) {
        return res.status(400).json({ error: "Username length must greater than 3" });
    };
    if (password.length < 6) {
        return res.status(400).json({ error: "Password length must greater than 6" });
    };
    if (password.length > 72) {
        return res.status(400).json({ error: "Password must be 72 characters or fewer" });
    };

    const validUsername = validateUsername(username);
    if (!validUsername) {
        return res.status(400).json({ error: "Invalid username" });
    }

    // Password hashing
    const hash = await bcrypt.hash(password, 10);

    try {
        result = db
            .prepare('INSERT INTO users (username, password) VALUES (?, ?)')
            .run(username, hash);

        // result.lastInsertRowId is the auto-assigned id of the new user
        issueToken(res, { id: result.lastInsertRowId, username: validUsername });
        res.json({ success: true, username });
    } catch (err) {
        if (err.message.includes("UNIQUE")) {
            return res.status(409).json({ error: "Username is already taken" });
        }
        console.error(err);
        res.status(500).json({ error: "Server error" });
    }
});

// POST /api/login
router.post('/login', authLimiter, async (req, res) => {

    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ error: "Username and password are required" });
    };

    const validUsername = validateUsername(username);
    if (!validUsername) {
        return res.status(400).json({ error: "Invalid username" });
    }

    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(validUsername);
    if (!user) {
        return res.status(401).json({ error: "Invalid username or password" });
    };

    const correct = await bcrypt.compare(password, user.password);
    if (!correct) {
        return res.status(401).json({ error: "Invalid username or password" });
    };

    issueToken(res, user);
    res.json({ success: true, username: user.username });
});

// POST /api/logout
router.post('/logout', (req, res) => {
    res.clearCookie("token");
    res.json({ success: true });
});

// GET /api/captcha
router.get('/captcha', (req, res) => {
    const { question, answer } = generateCaptcha();

    const captchaToken = jwt.sign(
        { answer },
        SECRET,
        { expiresIn: "5m" }
    );

    res.json({ question, captchaToken });
});

// GET /api/me
router.get('/me', (req, res) => {

    const token = req.cookies.token;
    if (!token) {
        return res.status(401).json({ error: "Not logged in" });
    };

    try {
        const payload = jwt.verify(token, SECRET);
        res.json({ id: payload.id, username: payload.username });
    } catch {
        res.status(401).json({ error: "Session expired, please log in again" });
    }
});

module.exports = router;