export interface Stop {
  id: string;
  address: string;
  coordinates?: [number, number]; // [lng, lat]
  geocodeError?: string;
  originalLine?: string;
  time?: string;
  direction?: string | null;
  isSchoolStop?: boolean; // True for school loading zone stops
  skipGeocoding?: boolean; // True for stops that should not be geocoded or displayed (e.g., CAB LOAD ZONE)
  schoolName?: string; // School name for school stops (displayed instead of address)
  neighborhood?: string; // Neighborhood name from reverse geocoding
}

export interface Route {
  id: string;
  name: string; // Route number only, e.g., "100"
  direction?: 'Morning' | 'Afternoon' | null; // "Morning" or "Afternoon"
  filename?: string;
  stops: Stop[];
  color: string;
  isSelected: boolean;
  geocodingProgress?: {
    total: number;
    geocoded: number;
    isGeocoding: boolean;
  };
  geometry?: [number, number][]; // Cached route geometry as [lat, lng][] following streets
  effectiveDate?: string | Date | null; // Effective date of the route
}

export interface HomeAddress {
  address: string;
  coordinates: [number, number];
  neighborhood?: string; // Neighborhood name from reverse geocoding
}

export interface School {
  id: string;
  name: string;
  address?: string; // Physical address of the school
  coordinates?: [number, number]; // [lng, lat] geocoded coordinates
  curbCoordinates?: [number, number]; // [lng, lat] specific curb drop-off point from route geometry
  schoolPageLink: string | null; // Link to school's page on PPS website
  driveLink: string | null; // Link to Google Drive folder with PDFs
  createdAt: string;
  updatedAt?: string;
  schoolTypes?: ('Elementary School' | 'Middle School' | 'High School')[]; // Array to support hybrid schools
  routeCount?: number; // Number of routes available for this school
  routesUpdatedAt?: string | null; // Latest modifiedTime from all routes for this school
  neighborhood?: string; // Neighborhood name from reverse geocoding
}

export interface AssignedSchool {
  name: string;
  district: string;
  type: string;
  website: string | null;
}

export interface AssignedSchools {
  elementary?: AssignedSchool;
  middle?: AssignedSchool;
  high?: AssignedSchool;
  k8?: AssignedSchool;
}

export interface AppState {
  driveLink?: string;
  lastFetchTime?: Date;
  routes: Route[];
  routesSchoolId: string | null;
  homeAddress?: HomeAddress;
  isLoading: boolean;
  error?: string;
  schools: School[];
  assignedSchools: AssignedSchools | null;
  isDarkMode: boolean;
  showElementaryBoundaries: boolean;
  showMiddleBoundaries: boolean;
  showHighBoundaries: boolean;
  showSchoolClosestModal: boolean;
  schoolClosestModalData: { schoolName: string; schoolId: string } | null;
}

export interface Neighborhood {
  name: string;
  count: number;
  routes: string[];
  stops: Array<{
    routeId: string;
    routeName: string;
    stopId: string;
    stopAddress: string;
    coordinates: [number, number];
  }>;
}

export type MapIntentType =
  | 'FIT_SCHOOLS'
  | 'ZOOM_SCHOOL'
  | 'FIT_ROUTES'
  | 'ZOOM_STOP'
  | 'FIT_HOME'
  | 'DOUBLE_FIT'
  | 'MANUAL'
  | 'STREET_HIGHLIGHT';

export interface MapIntent {
  type: MapIntentType;
  data?: any;
}



