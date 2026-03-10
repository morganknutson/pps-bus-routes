# Architecture (236 files, 4 modules, 474 edges)

## (root) (5 files, 337 lines)
- `debug-boundary.js` (64L, 0in/2out) — debug school boundary service with geocoding integration
- `fix-access-260.js` (51L, 0in/1out) — script to process school bus route PDFs and extract stop data
- `test-geocoding-format.js` (25L, 0in/1out) — test script for address formatting before geocoding with google maps
- `inspect-pdf.js` (27L) — script to fetch and inspect PDF structure from Google Drive
- `restore-from-cursor-history.js` (170L)

## backend (59 files, 14619 lines)
- `backend/server.js` (223L, 0in/17out) — Express.js backend server with route handlers and middleware
- `backend/services/geocodingService.js` (738L, 8in/4out) — service converting addresses to GPS coordinates
- `backend/services/routeProcessor.js` (394L, 8in/4out) — core service orchestrating PDF-to-JSON processing pipeline
- `backend/services/jobQueue/index.js` (35L, 6in/6out) — exports singleton instances for pdf sync job queue and worker service
- `backend/services/directionsService.js` (405L, 9in/1out) — service calculating street-following route geometry
- `backend/services/driveService.js` (493L, 8in/0out) — service accessing public Google Drive folders and PDFs
- `backend/services/weeklySyncService.js` (386L, 2in/6out) — service orchestrating weekly PDF synchronization workflow
- `backend/services/placesService.js` (322L, 7in/1out) — service searching school info via Google Places API
- `backend/services/streetGeometryService.js` (807L, 5in/3out) — service finding full street geometry by endpoints
- `backend/services/jobQueue/jobTypes.js` (35L, 8in/0out) — constants defining job types, statuses, and priorities
- ... +49 more

## frontend (105 files, 27787 lines)
- `frontend/src/App.tsx` (714L, 2in/43out) — main application component with routing and core ui layout
- `frontend/src/store/useStore.ts` (386L, 23in/6out) — Zustand state store for app-wide state management
- `frontend/src/pages/DesignSystemPage.tsx` (947L, 1in/27out) — design system showcase page displaying all UI components
- `frontend/src/types/index.ts` (116L, 25in/0out) — typescript type definitions for routes, stops, and schools
- `frontend/src/pages/HomePage.tsx` (946L, 1in/22out) — home page with school/route lookup, address search, and map
- `frontend/src/components/MapView.tsx` (1388L, 1in/21out) — main interactive map with routes, stops, and geocoding
- `frontend/src/hooks/useMediaQuery.ts` (57L, 19in/0out) — hook to detect viewport media query matches
- `frontend/src/components/Header.tsx` (404L, 13in/5out) — app header with navigation menu and dark mode toggle
- `frontend/src/components/AddressInput.tsx` (541L, 2in/16out) — address input with autocomplete and location detection
- `frontend/src/components/SchoolInfoTooltip.tsx` (501L, 4in/12out) — school information tooltip displayed on map
- ... +95 more

## scripts (67 files, 9477 lines)
- `scripts/process-beverly-cleary-am-manual.js` (254L, 0in/4out) — manually process beverly cleary am route based on screenshot data
- `scripts/verify-optimizations.js` (45L, 0in/2out) — verify api optimizations for places and autocomplete services
- `scripts/migrate-pdf-metadata.js` (182L, 0in/2out) — generate metadata for existing pdfs by matching drive files
- `scripts/process-beverly-cleary-am.js` (60L, 0in/1out) — process beverly cleary am pdf route and save to processed routes
- `scripts/add-missing-schools-temp.js` (107L, 0in/1out) — temporarily add missing schools to schools.json using places api
- `scripts/discover-school-links.js` (236L, 0in/1out) — discover and update google sites and drive links for all schools
- `scripts/recalculate-geometry.js` (81L, 0in/1out) — recalculate geometry for routes missing direction data
- `scripts/update-pdf-timestamps.js` (160L, 0in/1out) — update local pdf file timestamps to match google drive modified times
- `scripts/check-missing-schools.js` (68L, 0in/1out) — identify schools missing from schools.json using supported codes
- `scripts/geocode-schools.js` (242L, 0in/1out) — geocode school addresses and update schools.json with coordinates
- ... +57 more

## Most-Imported Files
- `frontend/src/types/index.ts` (25 dependents)
- `frontend/src/store/useStore.ts` (23 dependents)
- `frontend/src/hooks/useMediaQuery.ts` (19 dependents)
- `frontend/src/components/Header.tsx` (13 dependents)
- `frontend/src/hooks/useDarkMode.ts` (13 dependents)
