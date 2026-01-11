# --- Base ---
FROM node:24-slim AS base
WORKDIR /app

ENV NODE_ENV=production

# --- Dependencies ---
FROM base AS deps
COPY package.json package-lock.json ./
RUN corepack enable && npm install --frozen-lockfile

# --- Builder ---
FROM base AS builder
WORKDIR /app
RUN corepack enable

COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm build

# --- Runner ---
FROM base AS runner
WORKDIR /app
RUN corepack enable

ENV NODE_ENV=production

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/server.js ./server.js

EXPOSE 3000
CMD ["node", "server.js"]