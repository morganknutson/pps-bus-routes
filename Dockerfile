# Stage 1: Build the frontend
FROM node:18-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# Stage 2: Setup the backend
FROM node:18-alpine
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

# Start the application
CMD ["node", "backend/server.js"]
