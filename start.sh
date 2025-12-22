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

# Start the servers
echo "🚀 Starting frontend and backend servers..."
echo "   Frontend: http://localhost:5173"
echo "   Backend:  http://localhost:3001"
echo ""
echo "Press Ctrl+C to stop the servers."
echo ""

npm run dev





