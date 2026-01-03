#!/bin/bash

# PPS Bus Maps - Stop Script (macOS)
# Double-click this file to stop the app

cd "$(dirname "$0")"

echo "🛑 Stopping PPS Bus Maps..."

# Kill processes by port (3000 for frontend, 3005 for backend)
echo "   Checking ports 3000 and 3005..."
PIDS=$(lsof -ti :3000,3005 || true)
if [ -n "$PIDS" ]; then
    echo "   Stopping processes: $PIDS"
    echo "$PIDS" | xargs kill -9 2>/dev/null || true
fi

# Fallback: kill by name
echo "   Cleaning up any remaining Node processes..."
ps aux | grep "node.*server.js\|vite\|concurrently" | grep -v grep | awk '{print $2}' | xargs kill -9 2>/dev/null || true

echo ""
echo "✅ Servers stopped."
sleep 2
exit
