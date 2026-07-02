const Database = require('better-sqlite3');
const db = new Database('chat.db');
db.pragma('journal_mode = WAL');

// ─────────────────────────────────────
// TABLE: users
// ─────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    username   TEXT    UNIQUE NOT NULL,
    password   TEXT    NOT NULL,
    created_at TEXT    DEFAULT (datetime('now'))
  )
`);

// ─────────────────────────────────────
// TABLE: rooms
// ─────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS rooms (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT    UNIQUE NOT NULL,
    created_by INTEGER,
    created_at TEXT    DEFAULT (datetime('now'))
  )
`);

// ─────────────────────────────────────
// TABLE: messages
// room_id links each message to a room (it must be a valid room id)
// ─────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS messages (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    room_id    INTEGER NOT NULL,
    username   TEXT    NOT NULL,
    content    TEXT    NOT NULL,
    created_at TEXT    DEFAULT (datetime('now'))
  )
`);

// ─────────────────────────────────────
// TABLE: direct_messages
// convo_key = a unique identifier for a conversation between two users.
// e.g. user "alice" and user "bob" → convo_key = "alice|bob" (sorted alphabetically)
// This way alice→bob and bob→alice always use the same key.
// ─────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS direct_messages (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    convo_key   TEXT    NOT NULL,
    sender_name TEXT    NOT NULL,
    content     TEXT    NOT NULL,
    created_at  TEXT    DEFAULT (datetime('now'))
  )
`);

// Create a default #general room if no rooms exist yet
const roomCount = db.prepare("SELECT COUNT(*) as count FROM rooms").get();
if (roomCount.count === 0) {
  db.prepare("INSERT INTO rooms (name) VALUES (?)").run("general");
  console.log("Created default #general room");
}

module.exports = db;