# Stage 1: Build the frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
ARG VITE_POSTHOG_PROJECT_TOKEN
ARG VITE_POSTHOG_HOST=https://us.i.posthog.com
ARG VITE_POSTHOG_UI_HOST=https://us.posthog.com
ENV VITE_POSTHOG_PROJECT_TOKEN=$VITE_POSTHOG_PROJECT_TOKEN
ENV VITE_POSTHOG_HOST=$VITE_POSTHOG_HOST
ENV VITE_POSTHOG_UI_HOST=$VITE_POSTHOG_UI_HOST
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# Stage 2: Setup the backend
FROM node:20-alpine
WORKDIR /app

# Install production dependencies for the backend
COPY backend/package*.json ./backend/
RUN cd backend && npm install --production

# Copy backend source
COPY backend/ ./backend/

# Copy built frontend from Stage 1
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Create data directory structure (to be mounted as a volume)
RUN mkdir -p data/schools

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3005

# Expose the port
EXPOSE 3005

# Healthcheck (used by Coolify/Docker to detect unhealthy containers)
# Uses Node's built-in fetch so we don't need curl/wget in the image.
HEALTHCHECK --interval=30s --timeout=3s --start-period=20s --retries=3 \
  CMD ["node","-e","fetch('http://127.0.0.1:'+(process.env.PORT||3005)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]

# Start the application
CMD ["node", "backend/server.js"]
