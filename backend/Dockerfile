# ─────────────────────────────────────────────────────────────────────────────
# NEWSYT backend — production multi-stage build.
#
# Stage 1 (builder)  — installs all deps, runs prisma generate, compiles TS,
#                      then prunes dev deps so the tree can be copied wholesale.
# Stage 2 (runner)   — node:20-alpine + tini + openssl (prisma needs openssl),
#                      non-root user, runs the compiled JS only.
#
# Local dev still works via backend/docker-compose.yml — that file mounts the
# source over the COPY and overrides CMD to `npm run dev`.
# ─────────────────────────────────────────────────────────────────────────────

# ─── builder ────────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /usr/src/app

# bcrypt is a native module — needs python/make/g++ at build time only.
RUN apk add --no-cache python3 make g++

COPY package.json package-lock.json* ./
RUN npm ci

COPY prisma ./prisma
RUN npx prisma generate

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

RUN npm prune --omit=dev

# ─── runner ─────────────────────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /usr/src/app

RUN apk add --no-cache tini openssl

ENV NODE_ENV=production

COPY --from=builder /usr/src/app/package.json ./package.json
COPY --from=builder /usr/src/app/node_modules ./node_modules
COPY --from=builder /usr/src/app/dist ./dist
COPY --from=builder /usr/src/app/prisma ./prisma

RUN addgroup -S app && adduser -S app -G app \
    && mkdir -p /usr/src/app/uploads \
    && chown -R app:app /usr/src/app

USER app
EXPOSE 4000

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/index.js"]
