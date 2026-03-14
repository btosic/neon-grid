# Neon Grid — Cyberpunk Card Game

A full-stack 2-player multiplayer turn-based card game built with NestJS, React, and PostgreSQL.

## Quick Start

### Option 1: Docker (recommended)

```bash
docker-compose up --build
```

- Frontend: http://localhost:5173
- Backend API: http://localhost:3001
- PostgreSQL: localhost:5432

### Option 2: Local development

**Prerequisites:** Node.js 20+, PostgreSQL running locally

1. Install dependencies:

```bash
npm install
```

2. Configure environment:

```bash
cp backend/.env.example backend/.env
# Edit backend/.env with your Postgres credentials
```

3. Run dev servers (both backend + frontend):

```bash
npm run dev
```

4. Run tests:

```bash
npm run test
```

## Architecture

```
neon-grid/
├── backend/               # NestJS API + WebSocket server
│   └── src/modules/
│       ├── auth/          # JWT authentication
│       ├── users/         # User entity & service
│       └── games/
│           ├── domain/    # Pure game logic (reducer, events, commands)
│           ├── application/  # Game service (orchestrates commands)
│           ├── infrastructure/ # TypeORM entities & repositories
│           └── ws/        # WebSocket gateway
└── frontend/              # React + Vite + Zustand
    └── src/
        ├── pages/         # Register, Login, Dashboard, GameBoard
        ├── components/    # Card, BoardUnit
        ├── stores/        # Zustand auth & game stores
        ├── services/      # REST API client, WebSocket service
        └── types/         # Shared TypeScript types
```

## Game Rules

- 2 players, 20 HP each
- Draw 3 cards at start; draw 1 per turn
- Gain 2 Action Points each turn
- Play cards by spending AP; units attack once per turn
- Win by reducing opponent to 0 HP

### Cards

| Card            | Cost | ATK | HP  | Effect                                      |
| --------------- | ---- | --- | --- | ------------------------------------------- |
| Street Samurai  | 1    | 2   | 1   | —                                           |
| Corporate Guard | 1    | 1   | 3   | —                                           |
| Sniper          | 2    | 2   | 1   | On Play: deal 1 damage to target enemy unit |
| Kamikaze Drone  | 2    | 3   | 1   | On Death: deal 2 damage to enemy player     |
| EMP Blast       | 1    | —   | —   | Deal 2 damage to target unit                |
| Overclock       | 1    | —   | —   | Give target unit +2 ATK this turn           |

## API

### REST

- `POST /auth/register` — Register user
- `POST /auth/login` — Login, receive JWT
- `GET /games` — List games (auth required)
- `POST /games` — Create game (auth required)
- `POST /games/:id/join` — Join a waiting game (auth required)
- `GET /games/:id/replay` — Fetch ordered event stream (auth required)

### WebSocket

Connect: `ws://localhost:3001?token=<jwt>`

Send events:

- `join_game` → `{ gameId }`
- `play_card` → `{ gameId, cardInstanceId, targetInstanceId? }`
- `attack` → `{ gameId, attackerInstanceId, targetId, targetType }`
- `end_turn` → `{ gameId }`

Receive events:

- `game_state` → projected `GameState` (opponent hand is hidden)
- `error` → `{ message }`
