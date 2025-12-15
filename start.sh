#!/bin/bash

# PPS Bus Maps - Start Script
# Double-click this file or run: ./start.sh

echo "🚌 Starting PPS Bus Maps..."
echo ""

# Check if node_modules exist, if not install
if [ ! -d "node_modules" ] || [ ! -d "frontend/node_modules" ] || [ ! -d "backend/node_modules" ]; then
  echo "📦 Installing dependencies (first time only)..."
  npm run install:all
  echo ""
fi

# Start the servers with PM2 (auto-restart on crash)
echo "🚀 Starting frontend and backend servers with PM2..."
echo "   Frontend: http://localhost:5173"
echo "   Backend:  http://localhost:3001"
echo ""
echo "Servers will auto-restart if they crash."
echo "To stop: npm run pm2:stop"
echo "To view status: npm run pm2:status"
echo "To view logs: npm run pm2:logs"
echo ""

npm run pm2:start
npm run pm2:status
echo ""
echo "✅ Servers are running! They will automatically restart if they crash."
echo "   View logs with: npm run pm2:logs"
echo "   Stop servers with: npm run pm2:stop"





