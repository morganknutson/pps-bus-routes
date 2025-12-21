# Quick Setup Guide

## 1. Install Dependencies

```bash
npm run install:all
```

This will install dependencies for:
- Root project (concurrently for running both servers)
- Backend (Express, PDF parsing, etc.)
- Frontend (React, TypeScript, Leaflet, etc.)

## 2. Configure Backend (Optional)

**Good news:** You don't need an API key! The app works with public Google Drive folders without any setup.

However, if you want faster/more reliable access, you can optionally add a Google Drive API key:

1. Copy the example environment file:
```bash
cd backend
cp .env.example .env
```

2. Get a Google Drive API Key (optional):
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project (or use existing)
   - Enable "Google Drive API"
   - Go to "Credentials" → "Create Credentials" → "API Key"
   - Copy the API key

3. Add the API key to `backend/.env` (optional):
```
GOOGLE_API_KEY=your_actual_api_key_here
PORT=3002
```

**Note:** The app will work without this - it will parse the public Drive folder page instead.

## 3. Run the Application

From the root directory:
```bash
npm run dev
```

This starts both:
- Backend on http://localhost:3002
- Frontend on http://localhost:3000

## 4. Use the App

1. Open http://localhost:3000 in your browser
2. Paste your Google Drive folder link:
   ```
   https://drive.google.com/drive/folders/1BC03MH02DFuUL6teeq4jkcT2THRGgzxj
   ```
3. Click "Fetch Routes"
4. Wait for PDFs to be parsed and geocoded (this may take a minute)
5. Select routes to display on the map
6. Optionally add your home address

## Troubleshooting

**"Google Drive API not configured" error:**
- Make sure `GOOGLE_API_KEY` is set in `backend/.env`
- Restart the backend server after adding the key

**No routes found:**
- Verify the folder contains PDF files
- Check that the folder is publicly accessible
- Check browser console for errors

**Geocoding is slow:**
- This is normal - OpenStreetMap has rate limits (1 request/second)
- The app processes stops sequentially to respect rate limits
- Large folders may take several minutes

**PDF parsing issues:**
- The parser looks for cross-street addresses in common formats
- If stops aren't being found, the PDF format may be different
- Check the browser console for the raw PDF text (first 500 chars are logged)

