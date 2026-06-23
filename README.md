# Lucky Arcade — LAN Event Gaming Platform

A complete web-based arcade gaming platform designed for college LAN events. Three games, real-time winner feeds, leaderboard, and a full admin control panel for probability, outcomes, and rewards.

## Tech Stack

| Layer    | Technology                          |
|----------|-------------------------------------|
| Frontend | React, TypeScript, Tailwind, Framer Motion, Axios |
| Backend  | Node.js, Express, TypeScript        |
| Database | MySQL                               |
| Realtime | Socket.IO                           |

## Games

1. **Plinko Drop** — Ball drops through pegs into multiplier slots (0x–50x)
2. **Mango Quest** — 7×10 jungle grid; find mangos, avoid bombs
3. **Green Tap Rush** — 5×5 neon grid; tap the green tile before it vanishes

## Prerequisites

- **Node.js** 18+
- **MySQL** 8.0+
- A machine on your LAN to host the server

## Quick Start

### 1. Clone / open the project

```bash
cd ~/lucky-arcade
```

### 2. Set up MySQL

```bash
mysql -u root -p < database/schema.sql
```

### 3. Configure backend

```bash
cp backend/.env.example backend/.env
```

Edit `backend/.env`:

```env
PORT=3001
HOST=0.0.0.0
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=lucky_arcade
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123
BASE_BET=100
```

### 4. Install dependencies

```bash
npm run install:all
```

### 5. Start the backend

```bash
npm run dev:backend
```

The API seeds the admin account on first boot (`admin` / `admin123` by default).

### 6. Start the frontend (new terminal)

```bash
npm run dev:frontend
```

Open **http://localhost:5173** on the host machine.

---

## LAN Deployment

The platform is built to run on a single machine accessible to all devices on the same Wi‑Fi / Ethernet network.

### Step 1 — Find your host IP

**macOS / Linux:**
```bash
ipconfig getifaddr en0
# or
hostname -I
```

**Windows:**
```cmd
ipconfig
```
Look for `IPv4 Address` (e.g. `192.168.1.42`).

### Step 2 — Configure frontend for LAN

Create `frontend/.env`:

```env
VITE_API_URL=http://192.168.1.42:3001/api
VITE_SOCKET_URL=http://192.168.1.42:3001
```

Replace `192.168.1.42` with your actual LAN IP.

### Step 3 — Start services bound to all interfaces

Backend already uses `HOST=0.0.0.0`. Frontend Vite is configured with `host: '0.0.0.0'`.

```bash
# Terminal 1
npm run dev:backend

# Terminal 2
npm run dev:frontend
```

### Step 4 — Share the URL with players

Players on the same network open:

```
http://192.168.1.42:5173
```

Admin dashboard:

```
http://192.168.1.42:5173/admin/login
```

### Production build (optional, faster on event day)

```bash
npm run build
npm run start:backend
cd frontend && npx serve -l 5173 -s dist
```

Or serve the frontend `dist/` folder with any static file server on port 5173.

### Firewall

Allow inbound TCP on ports **3001** (API + Socket.IO) and **5173** (frontend):

**macOS:** System Settings → Network → Firewall → allow Node  
**Linux:** `sudo ufw allow 3001 && sudo ufw allow 5173`

---

## Admin Dashboard

Login at `/admin/login` with credentials from `.env`.

| Section           | Purpose                                      |
|-------------------|----------------------------------------------|
| Overview          | Stats, revenue, profit, event settings       |
| Games             | Per-game session and payout stats            |
| Analytics         | Hourly activity chart                        |
| Probabilities     | Edit odds for all three games + Plinko RTP   |
| Force Outcome     | Queue next-player result (jackpot, lose, etc.) |
| Rewards           | Add/edit/delete milestone rewards            |
| Board Designer    | Manual Mango Quest layout editor             |
| Winners / Live    | Real-time winner feed and active sessions    |

### Force Outcome Engine

Queue an outcome from the admin panel. The **next** player to start that game receives the predetermined result. The frontend animation visualizes the backend decision.

### Plinko RTP

Set RTP to 60%, 70%, 80%, 90%, or 95%. The system auto-adjusts multiplier probabilities.

---

## API Reference

### Public

| Method | Endpoint              | Description           |
|--------|-----------------------|-----------------------|
| GET    | `/api/home`           | Home page data        |
| POST   | `/api/player/join`    | Register display name |
| POST   | `/api/plinko/start`   | Start Plinko session  |
| POST   | `/api/plinko/finish`  | Complete Plinko       |
| POST   | `/api/mango/start`    | Start Mango Quest     |
| POST   | `/api/mango/reveal`   | Reveal a cell         |
| POST   | `/api/tap-rush/start` | Start Tap Rush        |
| POST   | `/api/tap-rush/finish`| Complete Tap Rush     |
| GET    | `/api/leaderboard`    | Leaderboard           |
| GET    | `/api/winners`        | Recent winners        |

### Admin (header: `x-admin-token`)

| Method | Endpoint                        | Description              |
|--------|---------------------------------|--------------------------|
| POST   | `/api/admin/login`              | Admin login              |
| GET    | `/api/admin/overview`           | Dashboard overview       |
| PUT    | `/api/admin/probabilities/:id`  | Update probabilities     |
| POST   | `/api/admin/plinko/rtp`         | Set Plinko RTP           |
| POST   | `/api/admin/force-outcome`      | Queue forced outcome     |
| CRUD   | `/api/admin/rewards`            | Reward management        |

---

## Socket.IO Events

| Event                      | Direction   | Description                |
|----------------------------|-------------|----------------------------|
| `player_joined`            | Server → All | New player entered        |
| `game_started`             | Server → All | Game session began        |
| `game_finished`            | Server → All | Game completed            |
| `winner_announced`         | Server → All | New winner                |
| `leaderboard_updated`      | Server → All | Leaderboard refresh       |
| `admin_changed_probability`| Server → All | Odds updated              |
| `admin_forced_outcome`     | Server → All | Forced outcome queued     |
| `jackpot_won`              | Server → All | Jackpot hit               |

---

## Project Structure

```
lucky-arcade/
├── backend/src/
│   ├── modules/
│   │   ├── admin/
│   │   ├── plinko/
│   │   ├── mango/
│   │   ├── tap-rush/
│   │   ├── analytics/
│   │   ├── leaderboard/
│   │   ├── probability-engine/
│   │   ├── reward-engine/
│   │   └── socket/
│   ├── routes/
│   └── database/
├── frontend/src/
│   ├── pages/
│   ├── components/
│   ├── services/
│   └── context/
└── database/schema.sql
```

---

## Default Credentials

| Role  | Username | Password  |
|-------|----------|-----------|
| Admin | admin    | admin123  |

Change these in `backend/.env` before your event.

---

## License

Built for LAN college events. Not intended for public internet deployment.
