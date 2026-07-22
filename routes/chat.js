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

// Room creation limiter
const createRoomLimiter = rateLimit({
    windowMs: 10 * 60 * 1000,
    max: 10,
    keyGenerator: (req) => req.user?.id?.toString() || req.ip,
    message: { error: "Too many rooms created, please slow down" }
});

// GET /api/rooms
router.get('/rooms', requireLogin, (req, res) => {
    const rooms = db
                  .prepare('SELECT id, name, created_at FROM rooms ORDER BY created_at ASC')
                  .all();
    res.json(rooms);
});

// POST /api/rooms
router.post('/rooms', requireLogin, (req, res) => {
    let name = req.body.name?.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");

    if(!name || name.length < 2) {
        return res.status(400).json({ error: "Room name must be at least 2 characters" });
    };
    
    try {

    const result = db.prepare("INSERT INTO rooms (name, created_by) VALUES (?, ?)").run(name, req.user.id);
        res.json({ id: result.lastInsertRowid, name });

    } catch {
        res.status(409).json({ error: "A room with that name already exists" });
    };
});

// GET /api/rooms/:roomId/messages
// Get last 50 messages in a room
router.get('/rooms/:roomId/messages', requireLogin, (req, res) => {
    const messages = db.prepare(`
        SELECT username, content, created_at
        FROM messages
        WHERE room_id = ?
        ORDER BY created_at ASC
        LIMIT 50
        `).all(req.params.roomId);
    
    res.json(messages);
});

// GET /api/users
// List all users
router.get('/users', requireLogin, (req, res) => {
    const users = db.prepare('SELECT id, username FROM users WHERE username != ? ORDER BY username ASC')
                    .all(req.user.username);
    res.json(users);
});

// GET /api/dm/:otherUsername/messages
// DM history between two users
router.get('/dm/:otherUsername/messages', requireLogin, (req, res) => {
    const key = [req.user.username, req.params.otherUsername].sort().join('|');

    const messages = db.prepare(`
        SELECT sender_name, content, created_at
        FROM direct_messages
        WHERE convo_key = ?
        ORDER BY created_at ASC
        LIMIT 50`).all(key);

    res.json(messages)
});

module.exports = router;