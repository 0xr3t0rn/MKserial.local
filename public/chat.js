// Handles Main chat page
let myUsername = null;
let currentRoom = null;
let currentDM = null;
let socket = null;

async function init() {
    // Check if logged in
    const res = await fetch('/api/me');
    const data = await res.json();

    if (!data.username) {
        window.location.href = '/';
        return;
    };
    // Store username and show it
    myUsername = data.username;
    document.getElementById('my-username').textContent = "Logged in as " + myUsername;

    // Connect to socket.io
    socket = io();

    // Listen for incoming room messages
    socket.on('new_messages', (msg) => {
        if (currentRoom) appendMessage(msg.username, msg.content, msg.created_at);
    });

    // Listen for incoming DMs
    socket.on('new_dm', (msg) => {
        if (currentDM) appendMessage(msg.sender_name, msg.content, msg.created_at);
    });

    // Load sidebar data
    await loadRooms();
    await loadUsers();
}

// Rooms
async function loadRooms() {
    const res = await fetch('/api/rooms');
    const rooms = await res.json();

    const list = document.getElementById('room-list');
    list.innerHTML = "";

    rooms.forEach(room => {
        const li = document.createElement('li');
        li.textContent = "# " + room.name;
        li.dataset.id = room.id;
        li.onclick = () => openRoom(room.id, room.name);
        list.appendChild(li);
    });

    if (rooms.length > 0) openRoom(rooms[0].id, rooms[0].name);
}

function showCreateRoom() {
    const box = document.getElementById('create-room-box');
    box.classList.toggle('hidden');
    if (!box.classList.contains('hidden')) {
        document.getElementById('room-name-input').focus();
    }
}

async function createRoom() {
    const input = document.getElementById('room-name-input');
    const name = input.value.trim();
    if (!name) return;

    const res = await fetch('/api/rooms', {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name })
    });
    const data = await res.json();

    if (data.error) {
        alert(data.error); return;
    }

    input.value = "";
    document.getElementById('create-room-box').classList.add('hidden');
    await loadRooms();
    openRoom(data.id, data.name);
}

async function openRoom(roomId, roomName) {
    const currentRoomId = roomId;
    const currentDMUser = null;

    socket.emit('join_room', roomId);
    
    document.getElementById('chat-title').textContent = "# " + roomName;
    document.getElementById('messages').innerHTML = "";

    highlightItem('room-list', roomId);
    clearHighlight('user-list');

    // Enable Input
    const input = document.getElementById('msg-input');
    const btn = document.getElementById('send-btn');

    input.disabled = false;
    btn.disabled = false;
    input.placeholder = "Message #" + roomName;
    input.focus();

    // Load message history via HTTP not Websocket (history is a one-time fetch)
    const res = await fetch(`/api/rooms/${roomId}/messages`);
    const messages = await res.json();
    messages.forEach(m => appendMessage(m.username, m.content, m.created_at));
}

// Users / DMs
async function loadUsers() {
    const res = await fetch('/api/users');
    const users = await res.json();

    const list = document.getElementById('user-list');
    list.innerHTML = "";

    users.forEach(user => {
        const li = document.createElement('li');
        li.textContent = "@ " + user.username;
        li.dataset.id = user.id;
        li.onclick = () => openDM(user.username);
        list.appendChild(li);
    });
}

async function openDM(otherUsername) {
    currentDM = otherUsername;
    currentRoom = null;

    socket.emit('join_dm', otherUsername);

    document.getElementById('chat-title').textContent = "@ " + otherUsername;
    document.getElementById('messages').innerHTML = "";

    highlightItem('user-list', null, otherUsername);
    clearHighlight('room-list');

    const input = document.getElementById('msg-input');
    const btn = document.getElementById('send-btn');
    input.disabled = false;
    btn.disabled = false;
    input.placeholder = "Message @" + otherUsername;
    input.focus();

    const res = await fetch(`/api/dm/${otherUsername}/messages`);
    const messages = await res.json();
    messages.forEach(m => appendMessage(m.sender_name, m.content, m.created_at));
}

// Send Messages
function sendMessages() {
    const input = document.getElementById('msg-input');
    const content = input.value.trim();

    if (!content) return;

    if (currentRoom) {
        socket.emit('send_message', { roomId: currentRoom, content });
    } else if (currentDM) {
        socket.emit('send_dm', { otherUsername: currentDM, content });
    }

    input.value = "";
}

// Append message to UI
function appendMessage(username, content, time) {
    const box = document.getElementById('messages');
    const div = document.createElement('div');
    div.classList.add('message');

    const timeStr = new Date(time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit"});

    div.innerHTML = `
        <div>
            <span class="msg-user">${escapeHtml(username)}</span>
            <span class="msg-time">${timeStr}</span>
        </div>
        <div class="msg-text">${escapeHtml(content)}</div>
        `;
    
    box.appendChild(div);
    box.scrollTop = box.scrollHeight;
}

function escapeHtml(text) {
    return String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&qout;")
        .replace(/'/g, "&#039;");
}

function highlightItem(listId, id, username) {
  document.querySelectorAll(`#${listId} li`).forEach(li => {
    let match = false;
    if (id)       match = li.dataset.id == id;
    if (username) match = li.textContent.includes(username);
    li.classList.toggle("active", match);
  });
}

function clearHighlight(listId) {
  document.querySelectorAll(`#${listId} li`).forEach(li => li.classList.remove("active"));
}


// Logout
async function logout() {
  await fetch("/api/logout", { method: "POST" });
  window.location.href = "/";
}


// Keyboard Shortcut
document.addEventListener("keydown", (e) => {
  if (e.key === "Enter") sendMessage();
});


// Start
init();