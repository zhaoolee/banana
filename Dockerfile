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
RUN npm ci --omit=dev
RUN npx playwright install --with-deps chromium

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server ./server
COPY --from=builder /app/shared ./shared

RUN mkdir -p /app/storage/generations /app/storage/logs

EXPOSE 23001

CMD ["node", "server/index.js"]
