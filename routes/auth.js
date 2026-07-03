///////////////////////////////////////////
// User authentication and authorization //
///////////////////////////////////////////
const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../db/database');
const router = express.Router();

const SECRET = process.env.JWT_SECRET;

// Helper function to create token and set it as cookie
function issueToken(res, user) {
    const token = jwt.sign(
        { id: user.id, username: user.username },
        SECRET,
        { expiresIn: "7d" }
    );

    res.cookie('token', token, {
        httpOnly: true,
        maxAge: 7 * 24 * 60 * 60 * 1000
    });
}

// POST /api/register
router.post('/register', async (req, res) => {
    const { username, password } = req.body;

    if(!username || !password){
        return res.status(400).json({ error: "Username and password are required" });
    };
    if(username.length < 3){
        return res.status(400).json({ error: "Username length must greater than 3" });
    };
    if(password.length < 6){
        return res.status(400).json({ error: "Password length must greater than 6" });
    };

    // Password hashing
    const hash = await bcrypt.hash(password, 10);

    try{
        result = db
                .prepare('INSERT INTO users (username, password) VALUES (?, ?)')
                .run(username, hash);

        // result.lastInsertRowId is the auto-assigned id of the new user
        issueToken(res, { id: result.lastInsertRowId, username });
        res.json({ success: true, username });
    } catch(err) {
        if(err.message.includes("UNIQUE")) {
            return res.status(409).json({ error: "Username is already taken" });
        }
        console.error(err);
        res.status(500).json({ error: "Server error" });
    }
});

// POST /api/login
router.post('/login', async (req, res) => {

    const { username, password } = req.body;
    if(!username || !password) {
        return res.status(400).json({ error: "Username and password are required" });
    };

    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
    if (!user) {
        return res.status(401).json({ error: "Invalid username or password" });
    };

    const correct = await bcrypt.compare(password, user.password);
    if(!correct) {
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

// GET /api/me
router.get('/me', (req, res) => {

    const token = req.cookies.token;
    if(!token){
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