# Scripts Documentation

## PDF Fetch Script (Recommended)

### `trigger-pdf-fetch.js` - Fetch PDFs from Google Drive

This script uses the job queue system to fetch PDFs from school Drive folders. It works with or without Redis.

**Usage:**

```bash
# Single school
node scripts/trigger-pdf-fetch.js <schoolId>

# All schools with drive links
node scripts/trigger-pdf-fetch.js --all

# Show help
node scripts/trigger-pdf-fetch.js --help
```

**Examples:**

```bash
# Fetch PDFs for Arleta school
node scripts/trigger-pdf-fetch.js arleta

# Fetch PDFs for all schools
node scripts/trigger-pdf-fetch.js --all
```

**Features:**
- Uses job queue system (background processing, retry logic)
- Automatic cleanup of orphaned PDFs (files removed from Drive)
- Polling-based status updates (works without Redis)
- Progress tracking and result summaries
- Error handling with clear messages

**Requirements:**
- Backend server must be running (default: http://localhost:3002)
- Schools must have `driveLink` configured in `data/schools.json`
- Works in development mode (no Redis required)

**Output:**
- PDFs saved to: `data/schools/{schoolId}/pdfs/`
- Job status tracked in job history
- Progress displayed in real-time

---

## Legacy Scripts

### `download-all-school-pdfs.js` (Deprecated)

⚠️ **This script is deprecated.** Use `trigger-pdf-fetch.js` instead.

The new script provides better error handling, orphaned PDF cleanup, and job queue integration.

### `download-via-api.js` (Legacy)

Legacy script for fetching routes via API. The new PDF fetch system supersedes this.





