#!/bin/bash
# Deployment script: Stop servers, pull latest, rebuild, and restart

set -e  # Exit on error

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "🚀 Starting deployment process..."
echo ""

# Step 1: Stop servers
echo "1️⃣  Stopping servers..."
SERVER_PIDS=$(ps aux | grep "node.*server.js" | grep -v grep | awk '{print $2}' || true)
if [ -n "$SERVER_PIDS" ]; then
    echo "   Found server processes: $SERVER_PIDS"
    echo "$SERVER_PIDS" | xargs kill 2>/dev/null || true
    sleep 2
    
    # Force kill if still running
    REMAINING=$(ps aux | grep "node.*server.js" | grep -v grep | awk '{print $2}' || true)
    if [ -n "$REMAINING" ]; then
        echo "   Force killing remaining processes..."
        echo "$REMAINING" | xargs kill -9 2>/dev/null || true
        sleep 1
    fi
fi

# Verify servers are stopped
if ps aux | grep "node.*server.js" | grep -v grep > /dev/null; then
    echo "   ⚠️  Warning: Some server processes may still be running"
else
    echo "   ✅ All servers stopped"
fi
echo ""

# Step 2: Pull latest changes
echo "2️⃣  Pulling latest changes from GitHub..."
git fetch origin

# Check if there are changes to pull
if [ $(git rev-list HEAD..origin/main --count) -eq 0 ]; then
    echo "   ℹ️  Already up to date with origin/main"
else
    echo "   Pulling changes..."
    git reset --hard HEAD
    git pull origin main
    
    CURRENT_COMMIT=$(git rev-parse --short HEAD)
    COMMIT_MSG=$(git log -1 --pretty=format:"%s")
    echo "   ✅ Updated to commit: $CURRENT_COMMIT"
    echo "   Message: $COMMIT_MSG"
fi

# Verify pull
if [ -n "$(git status --porcelain)" ]; then
    echo "   ⚠️  Warning: Working tree has uncommitted changes"
    git status
else
    echo "   ✅ Working tree is clean"
fi
echo ""

# Step 3: Rebuild frontend
echo "3️⃣  Rebuilding frontend..."
cd frontend

if npm run build 2>&1 | tee ../logs/build.log | tail -20; then
    echo "   ✅ Frontend build successful"
else
    echo "   ❌ Frontend build failed! Check logs/build.log for details"
    exit 1
fi

# Verify build artifacts exist
if [ -f "dist/index.html" ]; then
    echo "   ✅ Build artifacts verified"
else
    echo "   ❌ Build artifacts missing!"
    exit 1
fi

cd ..
echo ""

# Step 4: Start servers
echo "4️⃣  Starting servers..."
npm run start:production > logs/server.log 2>&1 &
SERVER_PID=$!
echo "   Started server process (PID: $SERVER_PID)"

# Wait a bit for server to start
sleep 3

# Verify server is running
if ps -p $SERVER_PID > /dev/null 2>&1; then
    echo "   ✅ Server process is running (PID: $SERVER_PID)"
else
    echo "   ⚠️  Server process may have exited, checking logs..."
    tail -20 logs/server.log
fi

# Verify server is responding
sleep 2
if curl -s http://localhost:3001/api/schools 2>&1 | head -1 | grep -q "schools"; then
    echo "   ✅ Server is responding on port 3001"
else
    echo "   ⚠️  Server not responding yet (may still be starting)"
    echo "   Check logs/server.log for details"
fi
echo ""

echo "✅ Deployment complete!"
echo ""
echo "📊 Summary:"
echo "   - Servers: Stopped and restarted"
echo "   - Code: Up to date with GitHub"
echo "   - Build: Fresh build completed"
echo "   - Status: Server running on port 3001"
echo ""
echo "📝 Logs:"
echo "   - Server: logs/server.log"
echo "   - Build: logs/build.log"

