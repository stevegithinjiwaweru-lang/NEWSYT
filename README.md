# NEWSYT - Last-Mile Logistics System

A full-stack last-mile delivery system with three connected applications:

| App | Stack | Purpose |
|-----|-------|----------|
| **backend/** | Node.js, Express, Prisma, PostgreSQL, Socket.IO | REST API, real-time tracking, CSV import, Easybox webhooks |
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
│  Rider App   │ ◄─────────────────────────┤
│    (Expo)    │                           │
└──────────────┘                      ┌────┴────────┐
                                      │  Easybox    │
                                      │  API/Events │
                                      └─────────────┘
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
# Edit .env with your database credentials and Easybox API keys
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
| Admin | `0700000000` | `password123` |

## Features

### Orders Management
- ✅ Create orders manually
- ✅ Upload orders via CSV (Carrefour, other merchants)
- ✅ Assign orders to riders
- ✅ Track order status in real-time
- ✅ Proof of delivery (POD) image upload

### CSV Upload

Expected CSV format:
```
customerName,phone,address,amount,paymentType,lat,lng
John Doe,0712345678,Karen,1500,COD,-1.2921,36.8219
Mary Smith,0720456789,Roysambu,2500,PREPAID,-1.2900,36.8200
```

Required columns: `customerName`, `phone`, `address`, `amount`
Optional columns: `paymentType` (default: COD), `lat`, `lng`

### Easybox Integration

Connect with Easybox dispatch service:

1. **Configure in .env:**
   ```
   EASYBOX_API_KEY=your-api-key
   EASYBOX_WEBHOOK_SECRET=your-secret-min-32-chars
   ```

2. **Create Zucchini merchant with API connector**

3. **Webhook endpoint:** `POST /webhooks/easybox`
   - Signature verification: HMAC-SHA256
   - Replay protection: 5-minute window
   - Events: created, assigned, picked_up, en_route, arrived, delivered, failed, cancelled

### Real-Time Tracking

| Event | Direction | Description |
|-------|-----------|-------------|
| `join` | Client → Server | Join dashboard or rider room |
| `rider:location:update` | Server → Dashboard | Live rider GPS |
| `order:assigned` | Server → Rider/Dashboard | New assignment |
| `order:tracking:update` | Server → Dashboard | Status change |

## API Overview

### Authentication
```bash
POST /auth/login
{ "phone": "0700000000", "password": "password123" }
```

### Orders
```bash
GET /orders                          # List all orders
POST /orders                         # Create order
GET /orders/:id                      # Get order
PUT /orders/:id                      # Update order
DELETE /orders/:id                   # Delete order
POST /orders/:id/assign              # Assign rider
POST /orders/upload-csv              # Bulk import
POST /orders/:id/upload-pod          # Upload POD
```

### Riders
```bash
GET /riders                          # List riders
POST /riders                         # Create rider
GET /riders/:id                      # Get rider
POST /riders/:id/location            # Update location
```

### Merchants
```bash
GET /merchants                       # List merchants
POST /merchants                      # Create merchant
PATCH /merchants/:id                 # Update merchant
POST /merchants/:id/sync             # Manual sync
```

## Docker (Full Stack)

```bash
cd backend
docker-compose up --build
```

This starts PostgreSQL, Redis, and the backend API on port 4000.

## Project Structure

```
NEWSYT/
├── backend/
│   ├── src/
│   │   ├── routes/          # API endpoints
│   │   ├── middlewares/      # Auth, validation
│   │   ├── socket.ts         # Real-time events
│   │   ├── app.ts            # Express setup
│   │   └── index.ts          # Entry point
│   ├── prisma/
│   │   ├── schema.prisma     # Database schema
│   │   └── seed.ts           # Database seeding
│   ├── .env.example
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── pages/            # React components
│   │   ├── api/              # API client
│   │   ├── services/         # Socket.IO, utils
│   │   └── App.tsx
│   ├── .env.example
│   └── package.json
├── riderapp/
│   ├── src/
│   │   ├── screens/          # Mobile screens
│   │   └── config.ts
│   └── package.json
└── README.md
```

## Troubleshooting

### CSV Upload fails
- Check column headers match exactly: `customerName`, `phone`, `address`, `amount`
- Ensure file is UTF-8 encoded
- Verify merchant has CSV connector type

### Easybox webhook not received
- Confirm webhook URL is publicly accessible
- Verify EASYBOX_WEBHOOK_SECRET is set
- Check X-Easybox-Signature header is present
- Review server logs for signature verification errors

### Socket.IO not connecting
- Ensure backend CORS includes frontend URL
- Check VITE_SOCKET_URL matches backend URL
- Browser console for WebSocket errors

## Contributing

1. Create feature branch: `git checkout -b feature/your-feature`
2. Commit changes: `git commit -m "feat: description"`
3. Push: `git push origin feature/your-feature`
4. Create Pull Request

## License

MIT
