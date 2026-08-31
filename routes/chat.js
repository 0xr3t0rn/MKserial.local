//////////////////////////////////////////////////////////////
// Handles rooms, messages, user list, and direct messages //
////////////////////////////////////////////////////////////
const express = require('express');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const db = require('../db/database');

const router = express.Router();
const SECRET = process.env.JWT_SECRET;

const bcrypt = require('bcrypt');
const { ipKeyGenerator } = rateLimit;

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
    keyGenerator: (req) => req.user?.id?.toString() || ipKeyGenerator(req),
    message: { error: "Too many rooms created, please slow down" }
});

// GET /api/rooms
router.get('/rooms', requireLogin, (req, res) => {
    const rooms = db
                  .prepare('SELECT id, name, created_at, passcode_hash, passcode_hint FROM rooms ORDER BY created_at ASC')
                  .all();

    // NEW: never send the actual hash to the browser — just whether
    // a passcode exists, and the hint text to show in the prompt
    const safeRooms = rooms.map(r => ({
        id: r.id,
        name: r.name,
        created_at: r.created_at,
        has_passcode: !!r.passcode_hash,
        hint: r.passcode_hint
    }));

    res.json(safeRooms);
});

// POST /api/rooms
router.post('/rooms', requireLogin, createRoomLimiter, async (req, res) => {
    let name = req.body.name?.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
    const { passcode, hint } = req.body; // NEW

    if(!name || name.length < 2) {
        return res.status(400).json({ error: "Room name must be at least 2 characters" });
    };

    // NEW: hash the passcode the same way passwords are hashed —
    // it's never stored as plain text
    let passcodeHash = null;
    if (passcode) {
        if (passcode.length < 4) {
            return res.status(400).json({ error: "Passcode must be at least 4 characters" });
        }
        passcodeHash = await bcrypt.hash(passcode, 10);
    }

    try {
        const result = db.prepare(
            "INSERT INTO rooms (name, created_by, passcode_hash, passcode_hint) VALUES (?, ?, ?, ?)"
        ).run(name, req.user.id, passcodeHash, hint || null);
        res.json({ id: result.lastInsertrowid, name });
    } catch {
        res.status(409).json({ error: "A room with that name already exists" });
    };
});

// GET /api/rooms/:roomId/messages
// Get last 50 messages in a room
router.get('/rooms/:roomId/messages', requireLogin, (req, res) => {
    const roomId = Number(req.params.roomId);
    if (!Number.isInteger(roomId) || roomId <= 0) {
        return res.status(400).json({ error: "Invalid room id" });
    }

    const room = db.prepare('SELECT passcode_hash FROM rooms WHERE id = ?').get(roomId);
    if (!room) return res.status(404).json({ error: "Room not found" });

    // NEW: locked rooms require a valid room token (from /unlock)
    if (room.passcode_hash) {
        const roomToken = req.headers['x-room-token'];
        if (!roomToken) return res.status(401).json({ error: "Passcode required" });

        try {
            const payload = jwt.verify(roomToken, SECRET);
            if (payload.roomId !== roomId || payload.uid !== req.user.id) {
                throw new Error("mismatch");
            }
        } catch {
            return res.status(401).json({ error: "Invalid or expired room access" });
        }
    }

    const messages = db.prepare(`
        SELECT username, content, created_at
        FROM messages
        WHERE room_id = ?
        ORDER BY created_at ASC
        LIMIT 50
        `).all(roomId);

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

// POST /api/rooms/:roomId/unlock
// Checks a passcode and, if correct, issues a short-lived token
// proving this user unlocked this specific room.
router.post('/rooms/:roomId/unlock', requireLogin, async (req, res) => {
    const roomId = Number(req.params.roomId);
    const { passcode } = req.body;

    const room = db.prepare('SELECT * FROM rooms WHERE id = ?').get(roomId);
    if (!room) return res.status(404).json({ error: "Room not found" });

    if (!room.passcode_hash) {
        return res.json({ success: true }); // room isn't locked, nothing to check
    }

    if (!passcode) {
        return res.status(400).json({ error: "Passcode required" });
    }

    const correct = await bcrypt.compare(passcode, room.passcode_hash);
    if (!correct) {
        return res.status(401).json({ error: "Incorrect passcode" });
    }

    const roomToken = jwt.sign(
        { uid: req.user.id, roomId },
        SECRET,
        { expiresIn: "2h" }
    );

    res.json({ success: true, roomToken });
});

// GET /api/stats — public site stats for the landing page terminal box
// NOTE: intentionally has no requireLogin — this needs to work
// before someone's logged in, on the main page itself.
router.get('/stats', (req, res) => {
    resetVisitsIfNewDay();

    const users = db.prepare('SELECT COUNT(*) AS c FROM users').get().c;
    const rooms = db.prepare('SELECT COUNT(*) AS c FROM rooms').get().c;
    const roomMsgs = db.prepare('SELECT COUNT(*) AS c FROM messages').get().c;
    const dmMsgs = db.prepare('SELECT COUNT(*) AS c FROM direct_messages').get().c;
    const visits = db.prepare("SELECT value FROM site_stats WHERE key = 'visits'").get()?.value || 0;

    res.json({
        users,
        rooms,
        messages: roomMsgs + dmMsgs,
        visits
    });
});

// POST /api/visit — bumps the visit counter by 1, called once per page load
router.post('/visit', (req, res) => {
    resetVisitsIfNewDay();

    db.prepare("UPDATE site_stats SET value = value + 1 WHERE key = 'visits'").run();
    const visits = db.prepare("SELECT value FROM site_stats WHERE key = 'visits'").get().value;
    res.json({ visits });
});

// resets the visit counter once a new UTC day starts
function resetVisitsIfNewDay() {
    const currentDay = Math.floor(Date.now() / 86400000); // days since epoch, UTC-based
    const row = db.prepare("SELECT value FROM site_stats WHERE key = 'last_reset_day'").get();

    if (!row) {
        // first time this has ever run — just record today, nothing to reset yet
        db.prepare("INSERT INTO site_stats (key, value) VALUES ('last_reset_day', ?)").run(currentDay);
        return;
    }

    if (row.value !== currentDay) {
        db.prepare("UPDATE site_stats SET value = 0 WHERE key = 'visits'").run();
        db.prepare("UPDATE site_stats SET value = ? WHERE key = 'last_reset_day'").run(currentDay);
    }
}
module.exports = router;