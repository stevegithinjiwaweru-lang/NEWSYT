# ─────────────────────────────────────────────────────────────────────────────
# NEWSYT frontend — Vite SPA, built once and served by nginx.
#
# VITE_API_URL is read at build time and baked into the bundle. Set it to the
# public origin of the API (e.g. https://api.dispatch.gumza.ke).
# ─────────────────────────────────────────────────────────────────────────────

# ─── builder ────────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /usr/src/app

COPY package.json package-lock.json* ./
RUN npm ci

COPY . .

ARG VITE_API_URL=""
ENV VITE_API_URL=${VITE_API_URL}

RUN npm run build

# ─── runner ─────────────────────────────────────────────────────────────────
FROM nginx:1.27-alpine AS runner

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /usr/src/app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
