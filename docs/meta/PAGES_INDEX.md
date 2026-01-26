# PPS Bus Maps - Pages Index

This document provides a comprehensive index of all pages in the application to help prevent confusion and ensure changes are made to the correct pages.

## Active Pages

### 1. HomePage (`/`)
- **File**: `frontend/src/pages/HomePage.tsx`
- **Purpose**: Landing page where users enter their address and school to find their bus stop
- **Key Features**:
  - Address autocomplete with suggestions
  - School search/autocomplete
  - Finds closest stop to user's address
  - Navigates to `/explore` (Explorer page) with results
- **State Management**: Uses Zustand store (`useStore`) for routes, schools, home address
- **Components Used**: `ProgressBar`
- **API Calls**: `/api/schools`, address autocomplete service
- **Navigation**: Navigates to `/explore` (Explorer page) after finding stop

---

### 2. About Page (`/about`)
- **File**: `frontend/src/pages/AboutPage.tsx`
- **Purpose**: Informational page about the application
- **Key Features**:
  - Explains the purpose of the app
  - Information about data sources
  - Disclaimer about official information

---

### 3. Contact Page (`/contact`)
- **File**: `frontend/src/pages/ContactPage.tsx`
- **Purpose**: Contact information for users
- **Key Features**:
  - PPS Transportation contact details
  - Technical support information

---

### 4. Explorer (`/explore`, `/schools`, or `/{schoolId}`)
- **Component**: `ExplorerApp` (defined in `frontend/src/App.tsx`)
- **Purpose**: Main interactive map page for exploring bus routes
- **Key Features**:
  - Two tabs: "Schools" and "Routes"
  - Schools tab: Browse and filter schools on map, select school to view info
  - Routes tab: View routes for selected school, select routes to display on map
  - Address input for finding closest stop
  - Interactive map with route visualization
  - School type filters (Elementary, Middle, High, Hybrid)
  - Search functionality for schools
  - **URL Structure**:
    - `/schools` or `/explore` - Show map with all schools
    - `/{schoolId}` - Show map focused on a specific school
- **State Management**: Uses Zustand store (`useStore`)
- **Components Used**:
  - `Header`, `Sidebar`, `TabBar`
  - `SchoolList` (in sidebar)
  - `RouteList` (in sidebar)
  - `MapView` (main map)
  - `AddressInput` (for routes tab)
  - `DarkModeTileLayer`
  - `ProgressBar` (loading indicator)
- **Data Loading**: 
  - Loads schools from `/api/schools`
  - Loads routes via `loadLocalRoutes()` service
- **Map Features**: 
  - School markers with color coding by type
  - Route polylines with unique colors
  - Stop markers
  - Auto-zoom to selected school or fit all schools
- **Special Notes**: 
  - Auto-selects "west-sylvan" school on mount if available
  - Shows school info dialog when school is selected in schools tab
  - Routes tab requires school selection

---

### 5. School Directory (`/school-directory`)
- **File**: `frontend/src/pages/SchoolDirectory.tsx`
- **Purpose**: A searchable, sortable list of all schools in the district.
- **Key Features**:
  - Search by school name or address
  - Filter by school level (Elementary, Middle, High)
  - Sorting options
  - Direct links to school routes
- **Special Note**: Previously at `/schools`. Redirects from `/schools-directory` to `/school-directory` are in place.

---

### 6. Admin Page (`/admin`)
- **Component**: `AdminApp` (defined in `frontend/src/App.tsx`)
- **Purpose**: Administrative interface for editing schools and managing routes
- **Key Features**:
  - Two tabs: "Schools" and "Routes"
  - Schools tab: Edit school information (address, coordinates, links, etc.)
  - Routes tab: View and manage routes with editing capabilities
  - Address lookup for geocoding
  - Street highlighting and street pins on map
  - Editing mode enabled
- **State Management**: Uses Zustand store (`useStore`)
- **Components Used**:
  - `Header`, `Sidebar`, `TabBar`
  - `SchoolList` (with `enableEditing={true}`)
  - `RouteList` (with `showBothOption={true}`)
  - `MapView` (with `editingMode={true}`, `enableStreetHighlighting={true}`, `enableStreetPins={true}`)
  - `AddressLookup` (for routes tab)
  - `DarkModeTileLayer`
  - `ProgressBar` (loading indicator)
- **Data Loading**: 
  - Loads schools from `/api/schools`
  - Loads routes via `loadLocalRoutes()` service
- **API Calls**: 
  - `PUT /api/schools/:id` for updating schools
- **Map Features**: 
  - Same as ExplorerApp but with editing capabilities
  - Street highlighting
  - Street pins for route editing
- **Special Notes**: 
  - Auto-selects "west-sylvan" school on mount if available
  - School editing updates are saved to backend
  - This is the PRIMARY admin interface (not the deprecated Data Management page)

---

### 4. Neighborhoods (`/neighborhoods`)
- **File**: `frontend/src/pages/Neighborhoods.tsx`
- **Purpose**: Explore bus routes by neighborhood boundaries
- **Key Features**:
  - Display neighborhood boundaries on map
  - Show routes that pass through neighborhoods
  - Filter and search neighborhoods
- **State Management**: Uses Zustand store (`useStore`)
- **Components Used**: Map components, neighborhood-specific components
- **API Calls**: `/api/neighborhoods` (likely)
- **Special Notes**: Neighborhood-based route exploration

---

### 5. Tech Page (`/tech`)
- **File**: `frontend/src/pages/TechPage.tsx`
- **Purpose**: Technical documentation page
- **Key Features**:
  - Documents the tech stack
  - Documents services and APIs
  - Documents data structures
  - Documents functionality
- **Special Notes**: 
  - **MUST be updated** whenever functionality or tech stack changes (per `.cursorrules`)
  - Contains comprehensive technical documentation
  - Has navigation sections for different topics

---

### 6. Verification Page (`/verification`)
- **File**: `frontend/src/pages/VerificationPage.tsx`
- **Purpose**: Verify and validate school stop data
- **Key Features**:
  - Verification reports
  - Data validation
  - Stop verification tools
- **State Management**: Uses Zustand store (`useStore`)
- **API Calls**: `/api/verification` (likely)
- **Special Notes**: Used for data quality assurance

---

### 7. Jobs Page (`/jobs`)
- **File**: `frontend/src/pages/JobsPage.tsx`
- **Purpose**: View and manage background jobs (PDF processing, geocoding, etc.)
- **Key Features**:
  - Job queue status
  - Job history
  - Job management
- **State Management**: Uses Zustand store (`useStore`)
- **API Calls**: `/api/jobs` (likely)
- **Special Notes**: Background job monitoring

---

## Deprecated Pages

### 8. Schools List (`/data/schools`) - **REMOVED**
- **File**: ~~`frontend/src/pages/SchoolsList.tsx`~~ (deleted)
- **Status**: ✅ **REMOVED** - Deprecated data management page has been deleted
- **Replacement**: Use `/admin` instead
- **Special Notes**: 
  - This page and its associated components have been completely removed
  - Related components also removed: `DataPageHeader.tsx`, `DataRouteList.tsx`

---

## Page Comparison Matrix

| Page | Route | Purpose | Editing | Street Highlighting | Street Pins | Address Input | School Editing |
|------|-------|---------|---------|-------------------|-------------|---------------|----------------|
| HomePage | `/` | Find stop | ❌ | ❌ | ❌ | ✅ (autocomplete) | ❌ |
| ExplorerApp | `/*` | Explore routes | ❌ | ❌ | ❌ | ✅ (simple) | ❌ |
| AdminApp | `/admin` | Admin interface | ✅ | ✅ | ✅ | ✅ (lookup) | ✅ |
| Neighborhoods | `/neighborhoods` | Neighborhood view | ❌ | ❌ | ❌ | ❌ | ❌ |
| TechPage | `/tech` | Documentation | ❌ | ❌ | ❌ | ❌ | ❌ |
| VerificationPage | `/verification` | Data verification | ❌ | ❌ | ❌ | ❌ | ❌ |
| JobsPage | `/jobs` | Job management | ❌ | ❌ | ❌ | ❌ | ❌ |

---

## Key Components Used Across Pages

### Shared Components
- `Header` - App header with navigation
- `Sidebar` - Sidebar container
- `TabBar` - Tab navigation (Schools/Routes/Neighborhoods)
- `MapView` - Main map component
- `DarkModeTileLayer` - Map tile layer with dark mode support
- `SchoolList` - List of schools with filtering
- `RouteList` - List of routes with selection
- `ProgressBar` - Loading progress indicator

### Page-Specific Components
- `AddressInput` - Simple address input (ExplorerApp)
- `AddressLookup` - Advanced address lookup with autocomplete (AdminApp)

---

## Common Patterns

### State Management
- All pages use Zustand store (`useStore`) from `frontend/src/store/useStore.ts`
- Global state includes: routes, schools, selectedSchoolId, homeAddress, loading states

### Data Loading
- Schools loaded from `/api/schools` endpoint
- Routes loaded via `loadLocalRoutes(schoolId)` service function
- Routes are school-specific

### Map Integration
- All map pages use `MapContainer` from react-leaflet
- Coordinate format: Internal `[lng, lat]`, Leaflet `[lat, lng]`
- Use `DarkModeTileLayer` for consistent tile rendering
- Custom icons via `utils/fontAwesomeIcons.ts` and `utils/markerIcons.ts`

### Navigation
- React Router v7 for routing
- Routes defined in `App.tsx`
- Navigation via `useNavigate()` hook or `<Link>` components

---

## Important Notes for Development

1. **Always check this index** before making changes to ensure you're working on the correct page
2. **Admin vs Explorer**: 
   - `/admin` = Admin interface with editing
   - `/*` = User-facing Explorer page
3. **Tech Page Updates**: Must update `TechPage.tsx` when functionality changes
4. **Component Reuse**: Many components are shared - check if changes affect multiple pages
5. **State Management**: Changes to store structure may affect multiple pages

---

## Quick Reference

- **User-facing pages**: `/` (HomePage), `/explore` (Explorer), `/neighborhoods` (Neighborhoods)
- **Admin pages**: `/admin`
- **Utility pages**: `/tech`, `/verification`, `/jobs`, `/data` (read-only)

---

*Last Updated: 2025-01-XX*
*This index should be updated when new pages are added or existing pages are modified significantly.*

