# Easybox Logistics Platform

A full-stack last-mile delivery system with three connected applications:

| App | Stack | Purpose |
|-----|-------|---------|
| **backend/** | Node.js, Express, Prisma, PostgreSQL, Socket.IO | REST API, real-time tracking, CSV import |
| **frontend/** | React, Vite, Ant Design | Dispatch dashboard for admins and dispatchers |
| **riderapp/** | Expo, React Native | Mobile app for delivery riders |

## Architecture

```
┌──────────────┐   REST + WebSocket   ┌──────────────┐
│   Frontend   │ ◄──────────────────► │   Backend    │
│  (port 5173) │                      │  (port 4000) │
└──────────────┘                      └──────┬───────┘
                                           │
┌──────────────┐   REST + WebSocket         │ PostgreSQL + Redis
│  Rider App   │ ◄─────────────────────────┘
│    (Expo)    │
└──────────────┘
```

## Prerequisites

- Node.js 18+
- PostgreSQL 15
- Redis 7 (optional, for CSV bulk import queue)
- Expo CLI (for rider app)

## Quick Start

### 1. Backend

```bash
cd backend
cp .env.example .env
npm install

# Start database (Docker)
docker-compose up -d db redis

# Run migrations and seed
npx prisma migrate dev --name init
npm run seed

# Start API server
npm run dev
```

API runs at **http://localhost:4000**

### 2. Frontend (Dispatch Dashboard)

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

Dashboard runs at **http://localhost:5173**

### 3. Rider App (Mobile)

```bash
cd riderapp
npm install
npm start
```

For physical devices, update `LOCAL_IP` in `riderapp/src/config.ts` to your machine's LAN address.

- Android emulator: `10.0.2.2`
- iOS simulator: `localhost`

## Default Credentials

| Role | Phone | Password |
|------|-------|----------|
| Admin / Dispatcher | `0700000000` | `password123` |
| Rider (James) | `0712345678` | `123456` |
| Rider (Peter) | `0720456789` | `123456` |

## End-to-End Flow

1. **Login** to the dashboard as admin (`0700000000`)
2. **Create orders** on the Orders page or upload a CSV
3. **Assign riders** on the Dispatch page
4. **Rider logs in** on the mobile app and sees assigned deliveries
5. **Rider starts delivery** — GPS location streams to the dashboard
6. **Track riders** live on the Tracking page
7. **Rider marks delivered** or uploads proof of delivery

## API Overview

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/login` | Login with phone + password |
| GET | `/auth/me` | Current user profile |
| GET | `/orders` | List all orders (dashboard) |
| GET | `/orders/mine` | Rider's assigned orders |
| PATCH | `/orders/:id/assign` | Assign rider to order |
| PATCH | `/orders/:id/status` | Update order status (rider) |
| POST | `/orders/:id/pod` | Upload proof of delivery |
| GET | `/riders` | List riders |
| POST | `/riders/:id/location` | Update rider GPS location |

## Real-Time Events (Socket.IO)

| Event | Direction | Description |
|-------|-----------|-------------|
| `join` | Client → Server | Join dashboard or rider room |
| `rider:location:update` | Server → Dashboard | Live rider GPS |
| `order:assigned` | Server → Rider/Dashboard | New assignment |
| `order:tracking:update` | Server → Dashboard | Status change |

## Docker (Full Stack)

```bash
cd backend
docker-compose up --build
```

This starts PostgreSQL, Redis, and the backend API on port 4000.

## Project Structure

```
NEWSYT/
├── backend/          API server, Prisma schema, Socket.IO
├── frontend/         React dispatch dashboard
├── riderapp/         Expo rider mobile app
└── README.md
```
