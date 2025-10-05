# Multi-stage build for Flight Booking Assistant
FROM node:18-alpine AS base

# Install build dependencies
RUN apk add --no-cache python3 make g++

# Backend build stage
FROM base AS backend-build
WORKDIR /app

# Copy backend package files
COPY package*.json ./
COPY tsconfig.json ./

# Install all dependencies (including dev for build)
RUN npm install

# Copy backend source
COPY src/ ./src/

# Build backend
RUN npm run build:backend

# Frontend build stage
FROM base AS frontend-build
WORKDIR /app/frontend

# Copy frontend package files
COPY frontend/package*.json ./

# Install frontend dependencies (use install instead of ci for flexibility)
RUN npm install --legacy-peer-deps

# Copy frontend source
COPY frontend/ ./

# Build frontend
RUN npm run build

# Production stage
FROM node:18-alpine AS production

# Create app directory
WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm install --production && npm cache clean --force

# Copy built backend from backend-build stage
COPY --from=backend-build --chown=nodejs:nodejs /app/dist ./dist

# Copy built frontend from frontend-build stage
COPY --from=frontend-build --chown=nodejs:nodejs /app/frontend/build ./frontend/build

# Copy necessary config files
COPY --chown=nodejs:nodejs tsconfig.json ./

# Create necessary directories
RUN mkdir -p logs && chown nodejs:nodejs logs

# Switch to non-root user
USER nodejs

# Expose port (Cloud Run uses PORT env var, default to 8080)
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:' + (process.env.PORT || 8080) + '/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# Start the application
CMD ["npm", "start"]