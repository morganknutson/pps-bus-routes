# Bus Route Mapping App - Development Plan

## Overview
An application that parses bus route PDFs, extracts stop locations (cross streets), and visualizes them on an interactive map with route lines and stop markers.

## Core Features

### 1. Google Drive Integration & PDF Parsing
- **Drive Link Input**: Input field for Google Drive folder/file link
- **PDF Fetching**: 
  - Parse Google Drive link (folder or individual files)
  - Fetch all PDFs from the Drive location
  - Handle public/shared links or API authentication
- **Auto-Refresh**: Optional periodic check for updated PDFs
- **PDF Text Extraction**: Extract text from PDF using a library like `pdf-parse` or `pdfjs-dist`
- **Route Detection**: Identify route names/numbers (may be in headers, titles, or first lines)
- **Stop Extraction**: Parse cross street addresses from the text
  - Pattern matching for common formats (e.g., "Main St & Oak Ave", "123 Main Street / 456 Oak Avenue")
  - Handle variations in formatting

### 2. Geocoding (Address → Coordinates)
- **Geocoding Service**: Use a service to convert street addresses to lat/lng coordinates
  - Options: Google Maps Geocoding API, Mapbox Geocoding API, or OpenStreetMap Nominatim (free)
- **Batch Processing**: Geocode all stops for a route
- **Error Handling**: Handle addresses that can't be geocoded (show warning, allow manual correction)

### 3. Route Management
- **Route List View**: Display all parsed routes in a sidebar/list
- **Route Selection**: Multi-select checkboxes to choose which routes to display
- **Route Metadata**: Show route name/number, number of stops
- **Color Assignment**: Automatically assign unique colors to each route

### 4. Map Visualization
- **Interactive Map**: Use a mapping library (Leaflet, Mapbox GL, or Google Maps)
- **Route Lines**: Draw colored polylines connecting stops in order
- **Stop Markers**: Place markers/pins at each stop location
- **Home Address Pin**: Special marker for user's home address
- **Zoom Controls**: Auto-fit map to show all selected routes

### 5. User Address Input
- **Address Input Field**: Text input or autocomplete for home address
- **Geocoding**: Convert user address to coordinates
- **Persistent Storage**: Save address in localStorage

## Technical Stack Proposal

### Option A: Web App (React + TypeScript)
**Frontend:**
- **Framework**: React with TypeScript
- **Build Tool**: Vite
- **Map Library**: Leaflet.js (free, open-source) or Mapbox GL JS
- **PDF Parsing**: `pdfjs-dist` (Mozilla's PDF.js)
- **Geocoding**: 
  - Mapbox Geocoding API (requires API key, free tier available)
  - Or OpenStreetMap Nominatim (free, no key needed, rate-limited)
- **Styling**: Tailwind CSS or CSS Modules
- **State Management**: React Context or Zustand

**Pros:**
- Cross-platform (works on any device with a browser)
- Easy to deploy (static hosting)
- No backend needed (can run entirely client-side)

**Cons:**
- PDF parsing in browser can be slower for large files
- Geocoding API rate limits may be an issue

### Option B: Electron Desktop App
Same stack as Option A but packaged as a desktop app.

**Pros:**
- Native app feel
- Can handle larger PDFs better
- More control over file system

**Cons:**
- More complex build process
- Larger app size

### Option C: Next.js Web App (with optional API routes)
Similar to Option A but with Next.js for better structure and optional backend API routes for geocoding.

## Recommended Approach: **Option A - React + TypeScript Web App**

### Why:
- Fastest to develop and deploy
- Works everywhere
- Can be hosted for free (Vercel, Netlify, GitHub Pages)
- Modern, maintainable codebase

## Project Structure

```
pps-bus-maps/
├── src/
│   ├── components/
│   │   ├── DriveLinkInput.tsx        # Google Drive link input component
│   │   ├── RouteList.tsx             # Sidebar with route checkboxes
│   │   ├── MapView.tsx               # Main map component
│   │   ├── AddressInput.tsx          # Home address input
│   │   └── StopMarker.tsx            # Custom marker component
│   ├── services/
│   │   ├── driveFetcher.ts           # Google Drive API integration
│   │   ├── pdfParser.ts              # PDF text extraction & parsing
│   │   ├── geocoder.ts               # Address to coordinates
│   │   └── routeProcessor.ts        # Route data processing
│   ├── types/
│   │   └── index.ts                  # TypeScript types
│   ├── utils/
│   │   ├── addressParser.ts          # Parse cross streets from text
│   │   └── colorGenerator.ts         # Generate route colors
│   ├── hooks/
│   │   ├── useRoutes.ts              # Route state management
│   │   └── useMap.ts                 # Map initialization
│   ├── App.tsx
│   └── main.tsx
├── public/
├── package.json
├── tsconfig.json
└── README.md
```

## Data Models

```typescript
interface Stop {
  id: string;
  address: string;        // Original address from PDF
  coordinates?: [number, number];  // [lng, lat] or [lat, lng]
  geocodeError?: string;
}

interface Route {
  id: string;
  name: string;           // Route number/name
  stops: Stop[];
  color: string;          // Hex color for display
  isSelected: boolean;
}

interface AppState {
  driveLink?: string;      // Google Drive folder/file link
  lastFetchTime?: Date;    // When PDFs were last fetched
  routes: Route[];
  homeAddress?: {
    address: string;
    coordinates: [number, number];
  };
}
```

## Implementation Phases

### Phase 1: Foundation
1. Set up React + TypeScript + Vite project
2. Install dependencies (Leaflet, pdfjs-dist, etc.)
3. Create basic layout (sidebar + map)
4. Set up routing/state management

### Phase 2: Google Drive Integration
1. Implement Drive link input and validation
2. Set up Google Drive API integration or direct download method
3. Fetch PDFs from Drive (handle folder vs individual files)
4. Parse Drive link format (folder ID, file ID, or shareable link)

### Phase 3: PDF Parsing
1. Extract text from fetched PDFs
2. Build address parser (regex patterns for cross streets)
3. Test with sample PDFs
4. Handle multiple PDFs (one route per PDF or multiple routes per PDF)

### Phase 4: Geocoding
1. Integrate geocoding service
2. Batch geocode stops
3. Handle errors gracefully
4. Cache results (localStorage)

### Phase 5: Map Visualization
1. Initialize map
2. Draw route lines
3. Add stop markers
4. Implement route selection
5. Color coding

### Phase 6: Home Address
1. Add address input
2. Geocode and display pin
3. Persist to localStorage

### Phase 7: Polish & Auto-Refresh
1. Error handling
2. Loading states
3. UI improvements
4. Responsive design
5. Export/import route data (optional)

## Challenges & Solutions

### Challenge 1: PDF Format Variations
**Solution**: Build flexible regex patterns, allow manual editing of parsed stops

### Challenge 2: Ambiguous Addresses
**Solution**: Use geocoding service with city/state context, show confidence indicators

### Challenge 3: Geocoding Rate Limits
**Solution**: 
- Cache results in localStorage
- Batch requests with delays
- Use free tier efficiently

### Challenge 4: Route Order
**Solution**: Assume stops are in order as listed in PDF, allow manual reordering if needed

### Challenge 5: Google Drive Access
**Solution**: 
- For public/shared links: Use direct download URLs (convert shareable link to direct download)
- For private folders: May need Google Drive API with OAuth (more complex)
- Handle CORS issues with proxy or backend if needed

## Dependencies (Estimated)

```json
{
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "leaflet": "^1.9.4",
    "react-leaflet": "^4.2.1",
    "pdfjs-dist": "^3.11.174",
    "zustand": "^4.4.7"
  },
  "devDependencies": {
    "@types/react": "^18.2.0",
    "@types/leaflet": "^1.9.8",
    "typescript": "^5.2.0",
    "vite": "^5.0.0",
    "@vitejs/plugin-react": "^4.2.0"
  }
}
```

**Note**: Google Drive integration can be done via:
- Direct download URLs (for public/shared files) - no additional dependencies
- Google Drive API (for private folders) - would need `googleapis` or similar
- Proxy server (to handle CORS) - if needed, could use a simple backend

## Next Steps

1. **Review this plan** - Confirm approach and make adjustments
2. **Choose geocoding service** - Decide on Mapbox (requires API key) or Nominatim (free)
3. **Get sample PDF** - If possible, share a sample PDF to test parsing
4. **Start implementation** - Begin with Phase 1

## Google Drive Integration Details

### Folder Information
- **Folder ID**: `1BC03MH02DFuUL6teeq4jkcT2THRGgzxj`
- **Folder Link**: `https://drive.google.com/drive/folders/1BC03MH02DFuUL6teeq4jkcT2THRGgzxj`
- **File Count**: ~40+ PDF files
- **Naming Pattern**: `{ROUTE}SYL-{DIRECTION}_effective_{DATE}.pdf`
  - Examples: `100SYL-A_effective_082625.pdf`, `100SYL-P_effective_082625.pdf`
  - Route numbers: 100, 101, 103, 104, 106, 111, 112, 113, 115, 116, 120, 121, 122, 124, 125, 126, 127, 132, 149
  - Directions: A (AM/Afternoon) and P (PM)
- **Access Level**: Public/shared (accessible without authentication)

### Approach Options:

**Option A: Google Drive API with Backend Proxy (Recommended)**
- Use Google Drive API to list folder contents
- Simple Node.js/Express backend endpoint to proxy requests
- Avoids CORS issues
- Can cache folder structure
- Requires Google API key (free tier available)

**Option B: Direct Download with Known File IDs**
- Hardcode file IDs (not ideal, requires manual updates)
- Use direct download URLs: `https://drive.google.com/uc?export=download&id=FILE_ID`
- Simple but not scalable

**Option C: Google Drive Folder Viewer Service**
- Use a third-party service or library that can parse public Drive folders
- May have limitations or require workarounds

### Recommended: **Option A (Backend Proxy)**
- Most reliable and scalable
- Can handle folder updates automatically
- Better error handling
- Can implement caching

### Implementation Strategy:
1. **Backend Endpoint** (Node.js/Express):
   - `/api/drive/folder/:folderId` - List all PDFs in folder
   - `/api/drive/file/:fileId` - Download specific PDF
   - Uses Google Drive API with service account or API key

2. **Frontend**:
   - Calls backend endpoints
   - No direct Google API calls (avoids CORS)
   - Simple and clean

## PDF Structure Analysis Needed

Before implementation, we should:
1. **Fetch a sample PDF** to understand the structure
2. **Identify the format** of cross street addresses in the PDFs
3. **Determine route naming** - how route names appear in PDFs vs filenames
4. **Test parsing logic** with actual PDF content

### Sample Files to Test:
- `100SYL-A_effective_082625.pdf` (AM route)
- `100SYL-P_effective_082625.pdf` (PM route)

## Questions to Consider

1. **Auto-Refresh**: Should the app automatically check for new/updated PDFs periodically?
2. **Route Display**: Should AM and PM routes be separate entries, or combined?
3. **Geocoding Service**: Prefer Mapbox (requires API key) or Nominatim (free, rate-limited)?
4. **Map Provider**: Prefer Leaflet (free), Mapbox, or Google Maps?
5. **Backend Hosting**: Where to host the backend proxy? (Vercel, Netlify Functions, or separate service)

