// Handles Main chat page
let myUsername = null;
let currentRoom = null;
let currentDM = null;
let socket = null;
let currentRoomToken = null;
let pendingRoom = null;
window.roomsById = {};

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
    socket.on('new_message', (msg) => {
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

    window.roomsById = {};

    const list = document.getElementById('room-list');
    list.innerHTML = "";

    rooms.forEach(room => {
        window.roomsById[room.id] = room;

        const li = document.createElement('li');
        li.textContent = "# " + room.name + (room.has_passcode ? " 🔒" : "");
        li.dataset.id = room.id;
        li.onclick = () => tryOpenRoom(room.id, room.name);
        list.appendChild(li);
    });

    if (rooms.length > 0) tryOpenRoom(rooms[0].id, rooms[0].name);
}

function showCreateRoom() {
    const box = document.getElementById('create-room-box');
    box.classList.toggle('hidden');
    if (!box.classList.contains('hidden')) {
        document.getElementById('room-name-input').focus();
    }
}

function tryOpenRoom(roomId, roomName) {
    const room = window.roomsById[roomId];
    const cachedToken = sessionStorage.getItem(`roomToken:${roomId}`);

    if (room?.has_passcode && !cachedToken) {
        showPasscodeModal(room, roomName);
        return;
    }

    openRoom(roomId, roomName, cachedToken);
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

async function openRoom(roomId, roomName, roomToken) {
    currentRoom = roomId;
    currentDM = null;
    currentRoomToken = roomToken || null;

    socket.emit('join_room', { roomId, roomToken: currentRoomToken });

    document.getElementById('chat-title').textContent = "# " + roomName;
    document.getElementById('messages').innerHTML = "";

    highlightItem('room-list', roomId);
    clearHighlight('user-list');

    const input = document.getElementById('msg-input');
    const btn = document.getElementById('send-btn');
    input.disabled = false;
    btn.disabled = false;
    input.placeholder = "Message #" + roomName;
    input.focus();

    const headers = currentRoomToken ? { 'x-room-token': currentRoomToken } : {};
    const res = await fetch(`/api/rooms/${roomId}/messages`, { headers });
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
function sendMessage() {
    const input = document.getElementById('msg-input');
    const content = input.value.trim();
    if (!content) return;

    if (currentRoom) {
        socket.emit('send_message', { roomId: currentRoom, content, roomToken: currentRoomToken });
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

    // Time
    const safeTime = time.includes('Z') ? time : time + 'Z';
    const dateObj = new Date(safeTime);
    const datePart = dateObj.toLocaleDateString([], { month: "short", day: "numeric" }); // e.g. "Jul 27"
    const timePart = dateObj.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); // e.g. "21:04"
    const timeStr = `${datePart}, ${timePart}`; // e.g. "Jul 27, 21:04"

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
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function highlightItem(listId, id, username) {
    document.querySelectorAll(`#${listId} li`).forEach(li => {
        let match = false;
        if (id) match = li.dataset.id == id;
        if (username) match = li.textContent.includes(username);
        li.classList.toggle("active", match);
    });
}

function clearHighlight(listId) {
    document.querySelectorAll(`#${listId} li`).forEach(li => li.classList.remove("active"));
}
// Modal logic
function showPasscodeModal(room, roomName) {
    pendingRoom = { id: room.id, name: roomName };
    document.getElementById('passcode-hint').textContent =
        room.hint || "This room is protected. Enter the passcode to continue.";
    document.getElementById('passcode-input').value = "";
    document.getElementById('passcode-error').classList.add('hidden');
    document.getElementById('passcode-modal').classList.remove('hidden');
    document.getElementById('passcode-input').focus();
}

function closePasscodeModal() {
    document.getElementById('passcode-modal').classList.add('hidden');
    pendingRoom = null;
}

async function submitPasscode() {
    const passcode = document.getElementById('passcode-input').value;
    if (!passcode || !pendingRoom) return;

    const res = await fetch(`/api/rooms/${pendingRoom.id}/unlock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passcode })
    });
    const data = await res.json();

    if (!data.success) {
        document.getElementById('passcode-error').textContent = data.error || "Incorrect passcode";
        document.getElementById('passcode-error').classList.remove('hidden');
        return;
    }

    if (data.roomToken) {
        sessionStorage.setItem(`roomToken:${pendingRoom.id}`, data.roomToken);
    }

    const room = pendingRoom;
    closePasscodeModal();
    openRoom(room.id, room.name, data.roomToken);
}

// Logout
async function logout() {
    await fetch("/api/logout", { method: "POST" });
    window.location.href = "/";
}


// Keyboard Shortcut
document.addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    const modalOpen = !document.getElementById('passcode-modal').classList.contains('hidden');
    modalOpen ? submitPasscode() : sendMessage();
});


// Start
init();