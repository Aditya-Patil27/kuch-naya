# ====================
# STAGE 1: Build the React Frontend
# ====================
FROM node:20-alpine AS frontend-builder
WORKDIR /app/flux-ui
COPY flux-ui/package*.json ./
RUN npm ci
COPY flux-ui/ ./
RUN npm run build

# ====================
# STAGE 2: Build the Backend & Worker
# ====================
FROM node:20-alpine
WORKDIR /app

# Install Docker CLI so shelljs can execute standard docker commands on the host daemon
RUN apk add --no-cache docker-cli

# Copy Node dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy source code and db init scripts
COPY server/ server/
COPY worker/ worker/
COPY db/ db/

# Copy the built React UI from Stage 1 into the location expected by server/index.js
COPY --from=frontend-builder /app/flux-ui/dist ./flux-ui/dist

# The default command runs the API Server, but this can be overridden in docker-compose.prod.yml
CMD ["node", "server/index.js"]
