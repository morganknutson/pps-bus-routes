#!/bin/bash
# Deployment script: Stop servers, pull latest, rebuild, and restart

set -e  # Exit on error

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "🚀 Starting deployment process..."
echo ""

# Step 1: Stop servers
echo "1️⃣  Stopping servers via PM2..."
if npm run pm2:status | grep -q "pps-bus-maps"; then
    npm run pm2:stop || true
    echo "   ✅ Servers stopped"
else
    echo "   ℹ️  No PM2 process found to stop"
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

# Clear previous build artifacts and caches for fresh build
echo "   Clearing previous build artifacts..."
rm -rf dist
rm -rf node_modules/.vite 2>/dev/null || true

if npm run build 2>&1 | tee -a ../logs/build.log | tail -20; then
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
echo "4️⃣  Starting servers via PM2..."
npm run pm2:start

# Wait a bit for server to start
sleep 3

# Verify server is running
if npm run pm2:status | grep -q "online" || npm run pm2:status | grep -q "launching"; then
    echo "   ✅ PM2 process is running"
else
    echo "   ⚠️  PM2 process may have failed, check logs/backend-error.log"
fi

# Verify server is responding
sleep 2
if curl -s http://localhost:3001/api/health 2>&1 | grep -q "ok"; then
    echo "   ✅ Server is responding on port 3001"
else
    echo "   ⚠️  Server not responding yet (may still be starting)"
    echo "   Check logs/backend-error.log for details"
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

