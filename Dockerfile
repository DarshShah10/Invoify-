FROM node:24-bookworm-slim AS build
WORKDIR /app
ENV PUPPETEER_SKIP_DOWNLOAD=true NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:24-bookworm-slim AS runtime
RUN apt-get update && apt-get install -y --no-install-recommends chromium fonts-liberation fonts-noto-core ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0 PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium NEXT_TELEMETRY_DISABLED=1
COPY --from=build --chown=node:node /app/.next-realfilms/standalone ./
COPY --from=build --chown=node:node /app/.next-realfilms/static ./.next-realfilms/static
COPY --from=build --chown=node:node /app/public ./public
RUN mkdir -p /var/lib/invoify/sessions && chown -R node:node /var/lib/invoify
USER node
EXPOSE 3000
CMD ["node", "server.js"]
