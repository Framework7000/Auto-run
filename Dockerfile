# Pinned to match the playwright version in package.json — the browser
# binary bundled in the image must match the npm package's expected
# revision, or Playwright refuses to launch it.
FROM mcr.microsoft.com/playwright:v1.56.0-noble

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY . .

# Browser profiles, the task db, and credentials all live here — a
# volume gets mounted over this path at deploy time so they survive
# redeploys instead of resetting with every build.
RUN mkdir -p /app/data

ENV NODE_ENV=production
EXPOSE 4173

ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["node", "server/index.js"]
