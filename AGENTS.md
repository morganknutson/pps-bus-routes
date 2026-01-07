# AGENTS.md - AI Agent Context (CCF)
**PPS Bus Maps**: PDF routes -> JSON -> Leaflet Map.

**Stack**: Node/Express, React/TS, Zustand, Leaflet, Google Maps API.
**Flow**: Google Drive (PDF) -> pdfParser -> geocodingService -> routeProcessor -> schools/{id}/processed-routes/*.json -> MapView.

**Critical Rules**:
- **NO PAID API CALLS ON LOAD**: (Exception: Debounced address autocomplete). Use cached data.
- **ICONS**: FontAwesome ONLY (`<i className="fas fa-icon">`). NO react-icons.
- **COORDS**: Internal/GeoJSON = `[lng, lat]`, Leaflet = `[lat, lng]`.
- **DATA**: `/admin` for management. `/data` is deprecated.
- **DOCS**: Update `TechPage.tsx` on logic changes.

**Key Structure**:
- `backend/server.js`: API entry.
- `backend/services/`: pdfParser, geocodingService, directionsService, routeProcessor.
- `frontend/src/store/useStore.ts`: Global state (Zustand).
- `frontend/src/types/index.ts`: Shared interfaces (Stop, Route, School).
- `data/schools.json`: Master school list.
- `data/schools/{id}/`: Raw PDFs and processed JSON routes.

**Common Tasks**:
- **Deploy**: Run `./deploy.sh`.
- **Test**: `npm test` (Full), `npm run test:backend`, `cd frontend && npm test`.
- **API**: Add route in `backend/routes/`, logic in `backend/services/`.

**Core Types (Condensed)**:
- `Stop`: `{ id, address, coordinates: [lng, lat], isSchoolStop, neighborhood }`
- `Route`: `{ id, name, direction, stops: Stop[], geometry: [lat, lng][] }`
- `School`: `{ id, name, coordinates: [lng, lat], driveLink }`

**Links**: [ARCHITECTURE.md], [PAGES_INDEX.md], [.cursorrules]

**URL/UI Sync**:
- **Logic**: Bidirectional sync between Zustand (`useStore.ts`) and URL (`useUrlState.ts`).
- **Rules**:
  - `setSelectedSchool` MUST clear routes/stops/`/my-stop` to prevent cross-school sync race conditions.
  - URL is source of truth on mount; `hasSyncedFromUrlRef` blocks sync-back loops until satisfying URL targets.
  - Route toggles MUST clear `selectedStop`.
  - Direction changes MUST attempt to carry over route/stop selection by name.
