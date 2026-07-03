// Handles Login/Register page
(async () => {
  try {
    const res  = await fetch("/api/me");
    const data = await res.json();
    if (data.username) window.location.href = "/chat.html";
  } catch (_) {}
  // catch ignores errors — a 401 just means "not logged in," which is fine here
})();

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

document.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;

    const loginVisible = !document.getElementById('login-form').classList.contains('hidden');
    loginVisible ? login(): register;
});