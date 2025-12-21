#!/bin/bash

# PPS Bus Maps - Start Script (macOS)
# Double-click this file to start the app

cd "$(dirname "$0")"

# Check if node_modules exist, if not install
if [ ! -d "node_modules" ] || [ ! -d "frontend/node_modules" ] || [ ! -d "backend/node_modules" ]; then
  echo "📦 Installing dependencies (first time only)..."
  npm run install:all
fi

# Start the servers
echo "🚀 Starting PPS Bus Maps..."
echo ""
echo "✅ Open your browser to:"
echo "   👉 http://localhost:5173  (Frontend - USE THIS!)"
echo ""
echo "   Backend API: http://localhost:3002 (API only, not a webpage)"
echo ""
echo "Press Ctrl+C to stop the servers."
echo ""

npm run dev

