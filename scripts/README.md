# Download Scripts

## Option 1: Via API (Recommended)

This uses the running backend server to fetch and parse routes:

```bash
# First, make sure the server is running:
npm run dev

# Then in another terminal:
node scripts/download-via-api.js
```

This will save all parsed routes to `data/routes.json`.

## Option 2: Direct Download (Requires API Key or Manual File IDs)

The direct download script tries to parse the Drive folder page, but this is less reliable. For best results, use Option 1.

## Output

All scripts save data to:
- `data/routes.json` - Parsed route data in JSON format
- `data/pdfs/` - Downloaded PDF files (if using direct download)




