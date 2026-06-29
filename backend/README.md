# Easybox Backend (Starter)

This is a starter backend for the Easybox Logistics system.

Stack:
- Node.js + TypeScript + Express
- Prisma + PostgreSQL
- Redis + BullMQ for background jobs
- Socket.io for realtime rider location updates
- Multer for file uploads (POD, CSV)
- fast-csv for CSV parsing

Quick start (local, using Docker)
1. Copy repo and create `.env` from `.env.example` (change secrets).
2. Start Postgres & Redis:
   docker-compose up -d
3. Install dependencies:
   npm install
4. Generate Prisma client:
   npx prisma generate
5. Run migrations:
   npx prisma migrate dev --name init
6. Seed database with sample data:
   npm run seed
7. Start backend:
   npm run dev
8. Start the worker in another terminal to process CSV jobs:
   npm run worker

Default admin
- phone: 0700000000
- password: password123

API endpoints (examples)
- POST /auth/register { phone, password, name } - create user
- POST /auth/login { phone, password } - returns { accessToken, refreshToken }
- GET /orders - list orders (Authorization: Bearer <token>)
- POST /orders - create order
- POST /orders/bulk-csv (multipart form-data file field `file`, merchantId) - upload CSV (enqueued)
- PATCH /orders/:id/assign { riderId } - assign order
- GET /riders - list riders
- POST /riders/:id/location { lat, lng, ts } - update rider location (also broadcasts via socket)

Realtime
- Socket.io namespaces:
  - /rider (riders connect and emit `location:update`)
  - /dispatch (dispatch consoles connect to receive `rider:location` events)

Notes
- This is a starting point; extend connector implementations for merchant APIs (Zuchinni) and implement auth token storage/rotation as needed.