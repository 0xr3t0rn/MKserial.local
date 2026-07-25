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
  "Bless all form of intelligence."
];

const taglineEl = document.getElementById("tagline");

// pick a random one immediately, so every refresh/visit starts on a
// different tagline instead of always the same first one
let taglineIndex = Math.floor(Math.random() * taglines.length);
taglineEl.textContent = taglines[taglineIndex];

setInterval(() => {
  taglineEl.style.opacity = 0;

  setTimeout(() => {
    taglineIndex = (taglineIndex + 1) % taglines.length;
    taglineEl.textContent = taglines[taglineIndex];
    taglineEl.style.opacity = 1;
  }, 500);
}, 6000); // seconds

// Tab switching
function showTab(tab) {
    const isLogin = tab === 'login';

    document.getElementById('login-form').classList.toggle('hidden', !isLogin);
    document.getElementById('register-form').classList.toggle('hidden', isLogin);
    document.getElementById('tab-login').classList.toggle('active', isLogin);
    document.getElementById('tab-register').classList.toggle('active', !isLogin);

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

    if (!username || !password) {
        return showError("Please fill in all fields");
    };

    const res = await fetch('/api/register', {
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

document.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;

    const loginVisible = !document.getElementById('login-form').classList.contains('hidden');
    loginVisible ? login(): register();
});