//////////////////////////////////////////////////////////////
// Handles rooms, messages, user list, and direct messages //
////////////////////////////////////////////////////////////
const express = require('express');
const jwt = require('jsonwebtoken');
const db = require('../db/database');

const router = express.Router();
const SECRET = process.env.JWT_SECRET;

function requireLogin(req, res, next) {
    const token = req.cookies.token;
    if(!token) {
        return res.status(401).json({ error: "Not logged in" });
    };

    try {
        req.user = jwt.verify(token, SECRET);
        next();
    } catch {
        res.status(401).json({ error: "Session expired" });
    };
}

router.get('/rooms', requireLogin, (req, res) => {
    const rooms = db
                  .prepare('SELECT id, name, created_at FROM rooms ORDER BY created_at ASC')
                  .all();
    res.json(rooms);
});