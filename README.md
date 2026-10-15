# MKserial.local

A real-time encrypted chat website where PRIVACY MATTERS!
It's designed for people who needs real privacy online, where you can chat anonymously without worrying about your digital identity and being tracked.

## Features
- User registration & login
- Create and join chat rooms
- Direct messages
- Real-time messaging via WebSockets
- Encrypted chats

## Tech Stack
- Node.js + Express
- Socket.io
- SQLite
- Vanilla HTML/CSS/JS frontend
##
![Screenshot](main-page.png)

## 🚀 Getting Started

### Prerequisites
- Node.js v18+ (tested with v20)
- npm v8+

### 1. Clone the repo
```bash
git clone https://github.com/your-username/MKserial.local.git
cd MKserial.local

2. Install dependencies
bash
npm install
3. Environment variables
Create a .env file in the project root:
env
JWT_SECRET=your-secret-key

4. Database auto-init
No manual SQL setup required. On first run, the app will automatically create:
users
rooms
messages
direct_messages
site_stats (with starter rows)

5. Run the server
bash
npm start
Server will start at: http://localhost:3000

6. Access frontend
Open http://localhost:3000/index.html — the public folder is served automatically.
All API routes (/api/*) will work without CORS or port mismatch.

🛡 Security Notes
Passwords and room passcodes are hashed with bcrypt.
JWT tokens are stored in HTTP-only cookies.
Rate limiting is applied to authentication routes.
Future improvements: add helmet, CSRF protection, and stricter cookie flags.