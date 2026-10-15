function validateUsername(username) {
  if (!username || typeof username !== "string") return null;
  const clean = username.trim();
  if (!/^[a-zA-Z0-9_-]{3,20}$/.test(clean)) return null;
  return clean;
}

function validateMessage(content) {
  if (!content || typeof content !== "string") return null;
  const text = content.trim().slice(0, 2000);
  return text.replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function validateRoomName(name) {
  if (!name || typeof name !== "string") return null;
  return name.trim().toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

module.exports = { validateUsername, validateMessage, validateRoomName };
