FROM node:20-alpine

WORKDIR /app

# Copy package files first for better layer caching
COPY package.json package-lock.json* ./

# Install production dependencies only (bcryptjs is pure JS — Alpine works fine)
RUN npm ci --omit=dev

# Copy application source
COPY src/ ./src/

# Copy pre-built web-portal and web-admin SPAs.
# These must be populated before building the image:
#   cp -r web-portal/dist express-backend/portal-dist
#   cp -r web-admin/dist  express-backend/admin-dist
# server.js serves them at /portal/* and /admin/*.
COPY portal-dist/ ./portal-dist/
COPY admin-dist/ ./admin-dist/

ENV NODE_ENV=production

# Cloud Run injects PORT=8080 automatically
EXPOSE 8080

CMD ["node", "src/server.js"]
