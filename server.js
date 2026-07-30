require('dotenv').config();

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const db = require('./db/database');
const authRouter = require('./routes/auth');
const chatRouter = require('./routes/chat');

const helmet = require('helmet');
const app = express();
app.set('trust proxy', 1);
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;
const SECRET = process.env.JWT_SECRET;

// Middleware
app.use(express.json({ limit: '10kb' }));
app.use(cookieParser());
app.use(express.static('public'));
app.use(helmet());

// Http Routes
app.use('/api', authRouter);
app.use('/api', chatRouter);

// Socket.io Middleware
io.use((socket, next) => {
  const rawCookies = socket.handshake.headers.cookie || "";

  const cookies = Object.fromEntries(
    rawCookies.split(';').map(part => {
      const [key, ...rest] = part.trim().split('=');
      return [key, decodeURIComponent(rest.join('='))];
    })
  );

  try {
    socket.user = jwt.verify(cookies.token, SECRET);
    next();
  } catch {
    next(new Error("Not authenticated"));
  }
});

// Socket.io Connections
io.on('connection', (socket) => {
  console.log(`${socket.user.username} connected`);

  // Event: client joins a chat room
  socket.on('join_room', ({ roomId, roomToken }) => {
    roomId = Number(roomId);
    if (!Number.isInteger(roomId) || roomId <= 0) return;

    const room = db.prepare('SELECT passcode_hash FROM rooms WHERE id = ?').get(roomId);
    if (!room) return;

    // NEW: same passcode check as the HTTP route, so locked rooms
    // can't be joined over the socket without a valid token either
    if (room.passcode_hash) {
        if (!roomToken) return;
        try {
            const payload = jwt.verify(roomToken, SECRET);
            if (payload.roomId !== roomId || payload.uid !== socket.user.id) return;
        } catch {
            return;
        }
    }

    if (socket.currentRoom) socket.leave(socket.currentRoom);
    socket.join("room-" + roomId);
    socket.currentRoom = "room-" + roomId;
    socket.currentDM = null;
  });

  // Event: client sends a room message
  socket.on('send_message', ({ roomId, content, roomToken }) => {
    if (!content?.trim() || !roomId) return;
    roomId = Number(roomId);

    // NEW: re-check the lock here too — without this, someone could
    // send messages into a locked room without ever unlocking it,
    // just by calling send_message directly
    const room = db.prepare('SELECT passcode_hash FROM rooms WHERE id = ?').get(roomId);
    if (!room) return;
    if (room.passcode_hash) {
        if (!roomToken) return;
        try {
            const payload = jwt.verify(roomToken, SECRET);
            if (payload.roomId !== roomId || payload.uid !== socket.user.id) return;
        } catch {
            return;
        }
    }

    const text = content.trim().slice(0, 2000);

    // Save to database (permanent)
    const result = db.prepare(
      'INSERT INTO messages (room_id, username, content) VALUES (?, ?, ?)'
    ).run(roomId, socket.user.username, text);

    // Message object to broadcast
    const message = {
      id: result.lastInsertRowid,
      username: socket.user.username,
      content: text,
      created_at: new Date().toISOString()
    };

    // Broadcast to everyone
    io.to("room-" + roomId).emit("new_message", message);
  });

  // Event: client joins a DM conversation
  socket.on("join_dm", (otherUsername) => {
    if (socket.currentRoom) socket.leave(socket.currentRoom);

    // Build the same convo key as in routes/chat.js
    const key = [socket.user.username, otherUsername].sort().join("|");
    socket.join("dm-" + key);
    socket.currentRoom = "dm-" + key;
    socket.currentDM   = key;
  });

  // Event: client sends a DM
  socket.on("send_dm", ({ otherUsername, content }) => {
    if (!content?.trim() || !otherUsername) return;

    const text = content.trim().slice(0, 2000);
    const key  = [socket.user.username, otherUsername].sort().join("|");

    // Save to database
    const result = db.prepare(
      "INSERT INTO direct_messages (convo_key, sender_name, content) VALUES (?, ?, ?)"
    ).run(key, socket.user.username, text);

    const message = {
      id:          result.lastInsertRowid,
      sender_name: socket.user.username,
      content:     text,
      created_at:  new Date().toISOString()
    };

    io.to('dm-' + key).emit('new_dm', message);
  });
  socket.on("disconnect", () => {
    console.log(`${socket.user.username} disconnected`);
  });
});

server.listen(PORT, () => {
  console.log(`Server running at port: ${PORT}`);
});