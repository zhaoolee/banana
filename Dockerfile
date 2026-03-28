FROM node:22-bookworm AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:22-bookworm

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=23001

COPY package.json package-lock.json ./
RUN apt-get update && apt-get install -y --no-install-recommends fontconfig && rm -rf /var/lib/apt/lists/*
RUN npm ci --omit=dev
RUN node node_modules/playwright/cli.js install --with-deps chromium
COPY server/assets/fonts /usr/local/share/fonts/opposans
RUN fc-cache -f -v

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server ./server
COPY --from=builder /app/shared ./shared

RUN mkdir -p /app/storage/generations /app/storage/logs

EXPOSE 23001

CMD ["node", "server/index.js"]
