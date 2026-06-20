# Use the official Playwright image — it has Chromium + all native deps
# pre-installed. The plain `node:20` image would need a long apt-get list
# (libnss3, libatk, libxkbcommon, fonts, ...) so we save ~300MB and ~2min.
FROM mcr.microsoft.com/playwright:v1.49.0-jammy

WORKDIR /app

ENV NODE_ENV=production \
    PORT=3000 \
    SCRAPE_TIMEOUT_MS=30000 \
    CACHE_TTL_MS=3600000 \
    CACHE_MAX=100 \
    HEADLESS=true

# Install only production deps.
COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund

COPY server.js extract.js cache.js ./

EXPOSE 3000

CMD ["node", "server.js"]
