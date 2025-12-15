#!/bin/bash

# PPS Bus Maps - Start Script (macOS)
# Double-click this file to start the app

cd "$(dirname "$0")"

# Check if node_modules exist, if not install
if [ ! -d "node_modules" ] || [ ! -d "frontend/node_modules" ] || [ ! -d "backend/node_modules" ]; then
  echo "📦 Installing dependencies (first time only)..."
  npm run install:all
fi

# Start the servers with PM2 (auto-restart on crash)
echo "🚀 Starting PPS Bus Maps with PM2..."
echo ""
echo "✅ Open your browser to:"
echo "   👉 http://localhost:5173  (Frontend - USE THIS!)"
echo ""
echo "   Backend API: http://localhost:3001 (API only, not a webpage)"
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

