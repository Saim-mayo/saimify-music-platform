FROM node:20-slim AS base

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev
RUN apt-get update && apt-get install -y curl --no-install-recommends && rm -rf /var/lib/apt/lists/*

COPY . .

RUN addgroup --system app && adduser --system --ingroup app app
USER app

EXPOSE 3000
ENV NODE_ENV=production

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl --fail http://127.0.0.1:3000/health || exit 1

CMD ["node", "server.js"]
