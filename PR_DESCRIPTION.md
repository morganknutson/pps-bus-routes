## 🎯 Overview

This PR fixes test failures and includes multiple improvements across the codebase, with a primary focus on fixing MapView component test failures and various performance optimizations.

## 🐛 Test Fixes

### MapView Component
- **Fixed test failures** by adding guards for Leaflet map methods in test environments
- Added type checks for `map.on`, `map.off`, and `map.whenReady` before calling them
- Prevents `TypeError: map.on is not a function` errors when running tests
- Ensures the component gracefully handles cases where the map instance may not be fully initialized

**Files changed:**
- `frontend/src/components/MapView.tsx`

## ⚡ Backend Performance Improvements

### Job Queue Services

#### JobHistoryService
- Reduced max history size from 10,000 to 1,000 jobs for better performance
- Implemented throttled saving mechanism (saves at most once every 5 seconds)
- Added immediate trimming on initialization if history is oversized
- Reduced max events per job from 50 to 20
- Added empty file check when loading history
- Improved error handling for corrupted or empty history files

#### PdfSyncJobQueue
- Optimized bulk sync job enqueueing by fetching active jobs once instead of in every iteration
- Uses Set for O(1) lookup instead of array iteration for deduplication
- Significantly reduces database/queue queries when enqueueing multiple jobs

#### WorkerService & SchedulerService
- Added support for `DISABLE_POLLING` environment variable
- Added support for `ENABLE_SCHEDULER` environment variable
- Scheduler now requires explicit `ENABLE_SCHEDULER=true` to run
- Improved logging to indicate why services are disabled

## 🎨 Frontend Enhancements

- Added analytics tracking functionality
- Enhanced tooltips (SchoolInfoTooltip, StopInfoTooltip)
- Added page tracking hook (`usePageTracking`)
- Improved HomePage features and interactions
- Enhanced App component routing and navigation

## 🧪 Testing

- Fixed all test failures (MapView component)
- Added missing test imports/assertions
- **All tests passing:** ✅ Backend (10), Frontend (69), Type checking

## 🛠️ Utilities

### stop.command
- **New file**: macOS double-clickable script to stop the application
- Kills processes on ports 3000 (frontend) and 3001 (backend)
- Includes fallback cleanup for Node processes
- Provides user-friendly feedback during shutdown

## 📊 Changes Summary

- **17 files changed**
- **289 insertions(+), 33 deletions(-)**
- All tests passing ✅

## ✅ Impact

- ✅ All tests now pass successfully
- ✅ Improved performance in job queue operations
- ✅ Better control over background services via environment variables
- ✅ Enhanced user experience with improved tooltips and analytics
- ✅ Added convenience script for stopping the application


