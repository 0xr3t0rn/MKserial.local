let captchaToken = null;

// Captcha
async function loadCaptcha() {
    const res = await fetch('/api/captcha');
    const data = await res.json();
    captchaToken = data.captchaToken;
    document.getElementById('captcha-question').textContent = data.question + " = ?";
    document.getElementById('captcha-answer').value = "";
}

// Timezone dropdown
function buildTimezoneList() {
    const now = new Date();
    const zones = Intl.supportedValuesOf('timeZone');

    const list = zones.map(zone => {
        const dtf = new Intl.DateTimeFormat('en-US', {
            timeZone: zone, hour12: false,
            year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit', second: '2-digit'
        });
        const parts = {};
        dtf.formatToParts(now).forEach(p => { parts[p.type] = p.value; });
        const asUTC = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour === '24' ? 0 : parts.hour, parts.minute, parts.second);
        const offsetMinutes = Math.round((asUTC - now.getTime()) / 60000);

        let name = zone;
        try {
            const nameParts = new Intl.DateTimeFormat('en-US', { timeZone: zone, timeZoneName: 'long' }).formatToParts(now);
            name = nameParts.find(p => p.type === 'timeZoneName')?.value || zone;
        } catch (_) {}

        const sign = offsetMinutes >= 0 ? '+' : '-';
        const abs = Math.abs(offsetMinutes);
        const hh = Math.floor(abs / 60);
        const mm = abs % 60;
        const offsetLabel = mm === 0 ? `${sign}${hh}` : `${sign}${hh}:${String(mm).padStart(2, '0')}`;

        return { zone, name, offsetMinutes, label: `[UTC ${offsetLabel}] ${name}` };
    });

    const seen = new Set();
    const deduped = list.filter(item => {
        if (seen.has(item.label)) return false;
        seen.add(item.label);
        return true;
    });

    deduped.sort((a, b) => a.offsetMinutes - b.offsetMinutes);
    return deduped;
}

function populateTimezones() {
    const select = document.getElementById('reg-timezone');
    const list = buildTimezoneList();
    const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;

    select.innerHTML = "";
    list.forEach(item => {
        const opt = document.createElement('option');
        opt.value = item.zone;
        opt.textContent = item.label;
        if (item.zone === detected) opt.selected = true;
        select.appendChild(opt);
    });
}

populateTimezones();

// Handles Login/Register page
(async () => {
  try {
    const res  = await fetch("/api/me");
    const data = await res.json();
    if (data.username) window.location.href = "/chat.html";
  } catch (_) {}
  // catch ignores errors — a 401 just means "not logged in," which is fine here
})();

// Main page
function showLogin() {
    document.querySelector(".auth-box").classList.remove("hidden");
    showTab("login");
}

function showRegister() {
    document.querySelector(".auth-box").classList.remove("hidden");
    showTab("register");
}

function closeAuth() {
    document.querySelector(".auth-box").classList.add("hidden");
}

// Auth page dragging
const authBox = document.getElementById("auth-box");
const header = document.getElementById("auth-header");

let isDragging = false;
let offsetX = 0;
let offsetY = 0;

header.addEventListener("mousedown", (e) => {
    isDragging = true;

    const rect = authBox.getBoundingClientRect();

    authBox.style.left = rect.left + "px";
    authBox.style.top = rect.top + "px";
    authBox.style.transform = "none";

    offsetX = e.clientX - rect.left;
    offsetY = e.clientY - rect.top;
});

document.addEventListener("mousemove", (e) => {
    if (!isDragging) return;

    authBox.style.left = (e.clientX - offsetX) + "px";
    authBox.style.top = (e.clientY - offsetY) + "px";

    authBox.style.transform = "none";
});

document.addEventListener("mouseup", () => {
    isDragging = false;
});

// Rotating tagline
const taglines = [
  "No system is safe.",
  "Don't trust the government!",
  "Stay paranoid.",
  "They're always watching.",
  "They're always listening.",
  "Privacy is not a crime.",
  "Bless all form of intelligence.",
  "You can help the poor without being a communist.",
  "Communism is just as bad as Capitalism.",
  "F*CK SOCIETY.",
  "Stay hidden.",
  "Down with Big Brother!",
  "The first rule of Fight Club is: you do not talk about Fight Club.",
  "Just because you can does not mean you should."
];

const taglineEl = document.getElementById("tagline");

// pick a random one immediately, so every refresh/visit starts on a
// different tagline instead of always the same first one
let taglineIndex = Math.floor(Math.random() * taglines.length);
taglineEl.textContent = taglines[taglineIndex];

function nextTagline() {
  taglineEl.style.opacity = 0;

  setTimeout(() => {
    taglineIndex = (taglineIndex + 1) % taglines.length;
    taglineEl.textContent = taglines[taglineIndex];
    taglineEl.style.opacity = 1;
  }, 500);
}

setInterval(nextTagline, 10000);

taglineEl.addEventListener("click", nextTagline);

// Live UTC clock
function updateUTCClock() {
  const now = new Date();

  const dateStr = now.toLocaleDateString('en-US', {
    timeZone: 'UTC', month: 'short', day: '2-digit', year: 'numeric'
  });
  const timeStr = now.toLocaleTimeString('en-GB', {
    timeZone: 'UTC', hour12: false
  });

  document.getElementById('utc-date').textContent = dateStr;
  document.getElementById('utc-time').textContent = timeStr + ' UTC';
}

updateUTCClock();
setInterval(updateUTCClock, 1000);

// Main page
// Terminal boot log + live stats
const bootLines = [
  "> initializing secure connection...",
];

async function typeLine(container, text) {
  const p = document.createElement("p");
  p.classList.add("cursor");
  container.appendChild(p);

  for (let i = 0; i < text.length; i++) {
    p.textContent = text.slice(0, i + 1);
    await new Promise(r => setTimeout(r, 20));
  }
  p.classList.remove("cursor");
}

async function runBootSequence() {
  const log = document.getElementById("terminal-log");
  for (const line of bootLines) {
    await typeLine(log, line);
    await new Promise(r => setTimeout(r, 300));
  }
  loadStats();
}

async function loadStats() {
  try {
    await fetch("/api/visit", { method: "POST" }); // counts this page load
    const res = await fetch("/api/stats");
    const data = await res.json();

    document.getElementById("stat-users").textContent = data.users;
    document.getElementById("stat-rooms").textContent = data.rooms;
    document.getElementById("stat-messages").textContent = data.messages.toLocaleString();
    document.getElementById("stat-visits").textContent = String(data.visits).padStart(6, "0");

    document.getElementById("terminal-stats").classList.remove("hidden");
  } catch (_) {
    // stats are decorative — fail silently if the server hiccups
  }
}

runBootSequence();

// Tab switching
function showTab(tab) {
    const isLogin = tab === 'login';

    document.getElementById('login-form').classList.toggle('hidden', !isLogin);
    document.getElementById('register-form').classList.toggle('hidden', isLogin);
    document.getElementById('tab-login').classList.toggle('active', isLogin);
    document.getElementById('tab-register').classList.toggle('active', !isLogin);

    if (!isLogin) loadCaptcha(); // NEW — fetch a fresh question every time Register opens

    clearError();
}

// Error box
function showError(msg) {
    const box = document.getElementById('error-box');
    box.textContent = msg;
    box.classList.remove('hidden');
}

function clearError() {
    document.getElementById('error-box').classList.add('hidden');
}

// Login
async function login() {
    clearError();

    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value;

    if (!username || !password) {
        return showError("Please fill in all fields");
    };

    const res = await fetch('/api/login', {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
    });

    const data = await res.json();

    if (data.success) {
        window.location.href = "/chat.html";
    } else {
        showError(data.error);
    }
}

// Register
async function register() {
    clearError();

    const username = document.getElementById('reg-username').value.trim();
    const password = document.getElementById('reg-password').value;
    const confirmPassword = document.getElementById('reg-confirm-password').value;
    const captchaAnswer = document.getElementById('captcha-answer').value.trim();
    const timezone = document.getElementById('reg-timezone').value;

    if (!username || !password) {
        return showError("Please fill in all fields");
    };

    if (password !== confirmPassword) {
        return showError("Passwords not matched")
    };

    const res = await fetch('/api/register', {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, captchaToken, captchaAnswer, timezone })
    });

    const data = await res.json();

    if (data.success) {
        window.location.href = "/chat.html";
    } else {
        showError(data.error);
        if (data.error?.includes("answer") || data.error?.includes("expired")) {
            loadCaptcha(); // wrong or expired — get a new question instead of retrying the same one
        }
    }
}

document.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;

    const loginVisible = !document.getElementById('login-form').classList.contains('hidden');
    loginVisible ? login(): register();
});