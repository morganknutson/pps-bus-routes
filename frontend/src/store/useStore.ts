import { create } from 'zustand';
import { AppState, Route, HomeAddress, School, Stop } from '../types';
import { generateRouteColor, generateRouteColorByName } from '../utils/colorGenerator';
import { saveRoutesToCache, mergeCachedCoordinates } from '../services/routeCache';
import { validateLngLat } from '../utils/coordinates';

interface Store extends AppState {
  setDriveLink: (link: string) => void;
  setRoutes: (routes: Route[]) => void;
  toggleRouteSelection: (routeId: string) => void;
  setHomeAddress: (address: HomeAddress) => void;
  clearHomeAddress: () => void;
  setLookupAddress: (address: HomeAddress) => void;
  clearLookupAddress: () => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | undefined) => void;
  updateStopCoordinates: (routeId: string, stopId: string, coordinates: [number, number]) => void;
  updateRouteGeocodingProgress: (routeId: string, progress: { total: number; geocoded: number; isGeocoding: boolean }) => void;
  setCurrentGeocodingRoute: (routeId: string | null) => void;
  setSelectedSchool: (schoolId: string | null) => void;
  setSchools: (schools: School[]) => void;
  selectStop: (route: Route, stop: Stop, stopNumber: number) => void;
  clearSelectedStop: () => void;
  setDirectionFilter: (direction: 'Morning' | 'Afternoon' | 'Both') => void;
  currentGeocodingRouteId: string | null;
  selectedStop: { route: Route; stop: Stop; stopNumber: number } | null;
  directionFilter: 'Morning' | 'Afternoon' | 'Both';
  lookupAddress: HomeAddress | undefined;
}

export const useStore = create<Store>((set) => ({
  driveLink: undefined,
  lastFetchTime: undefined,
  routes: [],
  homeAddress: undefined,
  lookupAddress: undefined,
  isLoading: false,
  error: undefined,
  selectedSchoolId: null,
  schools: [],
  currentGeocodingRouteId: null,
  selectedStop: null,
  directionFilter: 'Morning',

  setDriveLink: (link) => set({ driveLink: link }),

  setRoutes: (routes) => {
    // Merge with cached coordinates first
    const routesWithCache = mergeCachedCoordinates(routes);
    
    // Assign colors and calculate geocoding progress
    const routesWithColors = routesWithCache.map((route, index) => {
      const totalStops = route.stops.length;
      const geocodedStops = route.stops.filter(s => s.coordinates).length;
      
      return {
        ...route,
        // Use route name for consistent coloring across directions (e.g., "100" Morning and "100" Afternoon get same color)
        // Fall back to index-based coloring if route name is missing
        color: route.color || generateRouteColorByName(route.name || String(index)),
        isSelected: route.isSelected ?? true, // Default to selected
        geocodingProgress: {
          total: totalStops,
          geocoded: geocodedStops,
          isGeocoding: false,
        },
      };
    });
    
    set({ routes: routesWithColors });
    
    // Save to cache
    saveRoutesToCache(routesWithColors);
  },

  toggleRouteSelection: (routeId) =>
    set((state) => ({
      routes: state.routes.map((route) =>
        route.id === routeId
          ? { ...route, isSelected: !route.isSelected }
          : route
      ),
    })),

  setHomeAddress: (address) => {
    set({ homeAddress: address });
    // Save to localStorage
    localStorage.setItem('homeAddress', JSON.stringify(address));
  },

  clearHomeAddress: () => {
    set({ homeAddress: undefined });
    localStorage.removeItem('homeAddress');
  },

  setLookupAddress: (address) => {
    set({ lookupAddress: address });
    // Save to localStorage
    localStorage.setItem('lookupAddress', JSON.stringify(address));
  },

  clearLookupAddress: () => {
    set({ lookupAddress: undefined });
    localStorage.removeItem('lookupAddress');
  },

  setLoading: (loading) => set({ isLoading: loading }),

  setError: (error) => set({ error }),

  updateStopCoordinates: (routeId, stopId, coordinates) => {
    // Validate coordinates format [lng, lat]
    if (!validateLngLat(coordinates)) {
      console.error('[useStore] Invalid coordinates format:', coordinates);
      throw new Error(`Invalid coordinates format. Expected [lng, lat], got ${JSON.stringify(coordinates)}`);
    }
    
    set((state) => {
      const updatedRoutes = state.routes.map((route) => {
        if (route.id === routeId) {
          const updatedStops = route.stops.map((stop) =>
            stop.id === stopId
              ? { ...stop, coordinates }
              : stop
          );
          const geocodedCount = updatedStops.filter(s => {
            const coords = s.coordinates;
            return coords && Array.isArray(coords) && coords.length === 2 && 
                   typeof coords[0] === 'number' && typeof coords[1] === 'number' &&
                   !isNaN(coords[0]) && !isNaN(coords[1]);
          }).length;
          
          return {
            ...route,
            stops: updatedStops,
            geocodingProgress: {
              total: route.stops.length,
              geocoded: geocodedCount,
              isGeocoding: state.currentGeocodingRouteId === routeId,
            },
          };
        }
        return route;
      });
      
      // Save to cache whenever coordinates are updated (async to not block UI)
      // Batch cache updates to avoid too many writes
      setTimeout(() => {
        saveRoutesToCache(updatedRoutes);
      }, 100);
      
      return { routes: updatedRoutes };
    });
  },

  updateRouteGeocodingProgress: (routeId, progress) =>
    set((state) => ({
      routes: state.routes.map((route) =>
        route.id === routeId
          ? { ...route, geocodingProgress: progress }
          : route
      ),
    })),

  setCurrentGeocodingRoute: (routeId) =>
    set({ currentGeocodingRouteId: routeId }),

  setSelectedSchool: (schoolId) => {
    set({ selectedSchoolId: schoolId });
    // Save to localStorage
    if (schoolId) {
      localStorage.setItem('selectedSchoolId', schoolId);
    } else {
      localStorage.removeItem('selectedSchoolId');
    }
  },

  setSchools: (schools) => set({ schools }),

  selectStop: (route, stop, stopNumber) => set({ selectedStop: { route, stop, stopNumber } }),

  clearSelectedStop: () => set({ selectedStop: null }),

  setDirectionFilter: (direction) => set({ directionFilter: direction }),
}));

// Load saved state from localStorage on init
if (typeof window !== 'undefined') {
  // Load home address
  const savedAddress = localStorage.getItem('homeAddress');
  if (savedAddress) {
    try {
      const address = JSON.parse(savedAddress);
      useStore.getState().setHomeAddress(address);
    } catch (e) {
      console.error('Failed to load saved home address:', e);
    }
  }

  // Load selected school
  const savedSchoolId = localStorage.getItem('selectedSchoolId');
  if (savedSchoolId) {
    useStore.getState().setSelectedSchool(savedSchoolId);
  }

  // Load lookup address
  const savedLookupAddress = localStorage.getItem('lookupAddress');
  if (savedLookupAddress) {
    try {
      const address = JSON.parse(savedLookupAddress);
      useStore.getState().setLookupAddress(address);
    } catch (e) {
      console.error('Failed to load saved lookup address:', e);
    }
  }
}


