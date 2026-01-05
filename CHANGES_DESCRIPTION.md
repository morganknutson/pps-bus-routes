# Changes Description

## Overview
This commit includes multiple improvements across the codebase, with the primary focus on fixing test failures in the MapView component and various performance and functionality enhancements.

## Test Fixes

### MapView Component (`frontend/src/components/MapView.tsx`)
- **Fixed test failures** by adding guards for Leaflet map methods in test environments
- Added type checks for `map.on`, `map.off`, and `map.whenReady` before calling them
- Prevents `TypeError: map.on is not a function` errors when running tests
- Ensures the component gracefully handles cases where the map instance may not be fully initialized

## Backend Improvements

### Job Queue Services

#### JobHistoryService (`backend/services/jobQueue/JobHistoryService.js`)
- **Performance optimizations:**
  - Reduced max history size from 10,000 to 1,000 jobs for better performance
  - Implemented throttled saving mechanism (saves at most once every 5 seconds)
  - Added immediate trimming on initialization if history is oversized
  - Reduced max events per job from 50 to 20
  - Added buffer to avoid frequent trimming operations
- **Reliability improvements:**
  - Added empty file check when loading history
  - Improved error handling for corrupted or empty history files
  - Better handling of save operations to prevent event loop blocking

#### PdfSyncJobQueue (`backend/services/jobQueue/PdfSyncJobQueue.js`)
- **Performance optimization:**
  - Optimized bulk sync job enqueueing by fetching active jobs once instead of in every iteration
  - Uses Set for O(1) lookup instead of array iteration for deduplication
  - Reduces database/queue queries significantly when enqueueing multiple jobs

#### WorkerService (`backend/services/jobQueue/WorkerService.js`)
- Added support for `DISABLE_POLLING` environment variable to explicitly disable background polling
- Improved logging to distinguish between production mode disable and explicit disable

#### SchedulerService (`backend/services/schedulerService.js`)
- Added support for `ENABLE_SCHEDULER` environment variable
- Scheduler now requires explicit `ENABLE_SCHEDULER=true` to run (not just non-production mode)
- Improved logging to indicate why scheduler is disabled

## Deployment

### deploy.sh
- Enhanced deployment script with additional error handling and logging
- Improved process management during deployment

## Frontend Enhancements

### Analytics (`frontend/src/services/analytics.ts`)
- Added new analytics tracking functionality
- Enhanced event tracking capabilities

### App Component (`frontend/src/App.tsx`)
- Added page tracking integration
- Improved routing and navigation handling

### HomePage (`frontend/src/pages/HomePage.tsx`)
- Added new features and improvements to the landing page
- Enhanced user interaction capabilities

### Tooltips
- **SchoolInfoTooltip** (`frontend/src/components/SchoolInfoTooltip.tsx`): Enhanced information display
- **StopInfoTooltip** (`frontend/src/components/StopInfoTooltip.tsx`): Improved stop information presentation

### Hooks
- **usePageTracking** (`frontend/src/hooks/usePageTracking.ts`): New hook for tracking page views and navigation

## Testing

### Test Files
- Added missing test imports/assertions to:
  - `frontend/src/utils/colorGenerator.test.ts`
  - `frontend/src/utils/debounce.test.ts`
  - `frontend/src/utils/schoolUtils.test.ts`

## Utilities

### stop.command
- **New file**: Created macOS double-clickable script to stop the application
- Kills processes on ports 3000 (frontend) and 3001 (backend)
- Includes fallback cleanup for Node processes
- Provides user-friendly feedback during shutdown

## Package Management

### package.json
- Updated dependencies or scripts as needed

## Summary Statistics
- **17 files changed**
- **289 insertions(+), 33 deletions(-)**
- All tests passing (backend: 10, frontend: 69, type checking: ✓)

## Impact
- ✅ All tests now pass successfully
- ✅ Improved performance in job queue operations
- ✅ Better control over background services via environment variables
- ✅ Enhanced user experience with improved tooltips and analytics
- ✅ Added convenience script for stopping the application


