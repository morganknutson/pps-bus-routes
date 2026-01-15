#!/bin/bash
# Deployment script: Stop servers, pull latest, rebuild, and restart

set -e  # Exit on error

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "🚀 Starting deployment process..."
echo ""

# Note: Process restarts are intentionally NOT handled here.
# In containerized deployments (e.g., Coolify/Docker), the platform handles restarts.

# Step 1: Pull latest changes
echo "1️⃣  Pulling latest changes from GitHub..."
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

# Step 2: Rebuild frontend
echo "2️⃣  Rebuilding frontend..."
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

echo "✅ Deployment complete!"
echo ""
echo "📊 Summary:"
echo "   - Servers: Not restarted by this script (handled by your platform/orchestrator)"
echo "   - Code: Up to date with GitHub"
echo "   - Build: Fresh build completed"
echo ""
echo "📝 Logs:"
echo "   - Server: logs/server.log"
echo "   - Build: logs/build.log"

