import { create } from 'zustand';
import { AppState, Route, HomeAddress, School, Stop, MapIntent } from '../types';
import { assignUniqueColors } from '../utils/colorGenerator';
import { saveRoutesToCache, mergeCachedCoordinates } from '../services/routeCache';
import { validateLngLat } from '../utils/coordinates';
import { debounce } from '../utils/debounce';
import { assignedSchoolsService } from '../services/assignedSchoolsService';

interface Store extends AppState {
  initialize: (options?: { skipSchoolSelection?: boolean }) => void;
  setDriveLink: (link: string) => void;
  routesSchoolId: string | null;
  setRoutes: (routes: Route[], schoolId?: string | null) => void;
  clearRoutes: () => void;
  setHomeAddress: (address: HomeAddress) => void;
  clearHomeAddress: () => void;
  setLookupAddress: (address: HomeAddress) => void;
  clearLookupAddress: () => void;
  setLoading: (loading: boolean) => void;
  setLoadingProgress: (progress: number | null) => void; // 0-100 or null for indeterminate
  setError: (error: string | undefined) => void;
  updateStopCoordinates: (routeId: string, stopId: string, coordinates: [number, number]) => void;
  updateRouteGeocodingProgress: (routeId: string, progress: { total: number; geocoded: number; isGeocoding: boolean }) => void;
  setCurrentGeocodingRoute: (routeId: string | null) => void;
  setSchools: (schools: School[]) => void;
  toggleDarkMode: () => void;
  setIsDarkMode: (isDark: boolean) => void;
  setMapIntent: (intent: MapIntent | null) => void;
  mapIntent: MapIntent | null;
  lastRouteNames: string[] | null;
  setLastRouteNames: (names: string[] | null) => void;
  lastDirection: string | null;
  setLastDirection: (direction: string | null) => void;
  lastStopId: string | null;
  setLastStopId: (stopId: string | null) => void;
  lastFocus: string | null;
  setLastFocus: (focus: string | null) => void;
  currentGeocodingRouteId: string | null;
  lookupAddress: HomeAddress | undefined;
  loadingCount: number;
  loadingProgress: number | null; // 0-100 or null for indeterminate
  assignedSchools: import('../types').AssignedSchools | null;
  fetchAssignedSchools: (lat: number, lng: number) => Promise<void>;
  boundaries: any[] | null;
  showBoundaries: boolean;
  showElementaryBoundaries: boolean;
  showMiddleBoundaries: boolean;
  showHighBoundaries: boolean;
  fetchBoundaries: () => Promise<void>;
  toggleBoundaries: () => void;
  toggleBoundaryType: (type: 'elementary' | 'middle' | 'high') => void;
  toggleAllBoundaries: (show: boolean) => void;
  setShowSchoolClosestModal: (show: boolean, data?: { schoolName: string; schoolId: string }) => void;
}

export const useStore = create<Store>((set, get) => {
  // Create a debounced function for saving to cache to prevent race conditions
  // and redundant writes to localStorage during bulk updates
  const debouncedSaveToCache = debounce(() => {
    saveRoutesToCache(get().routes);
  }, 250);

  return {
    driveLink: undefined,
    lastFetchTime: undefined,
    routes: [],
    routesSchoolId: null,
    homeAddress: undefined,
    lookupAddress: undefined,
    isLoading: false,
    loadingCount: 0,
    loadingProgress: null as number | null, // 0-100 or null for indeterminate
    error: undefined,
    schools: [],
    currentGeocodingRouteId: null,
    mapIntent: null,
    lastRouteNames: null,
    lastDirection: null,
    lastStopId: null,
    lastFocus: null,
    assignedSchools: null,
    boundaries: null,
    showBoundaries: false,
    showElementaryBoundaries: false,
    showMiddleBoundaries: false,
    showHighBoundaries: false,
    showSchoolClosestModal: false,
    schoolClosestModalData: null,
    isDarkMode: (() => {
      if (typeof window !== 'undefined') {
        const saved = localStorage.getItem('darkMode');
        if (saved !== null) return saved === 'true';
        if (typeof window.matchMedia === 'function') {
          return window.matchMedia('(prefers-color-scheme: dark)').matches;
        }
      }
      return false;
    })(),

    initialize: (options) => {
      if (typeof window === 'undefined') return;

      // Load home address
      const savedAddress = localStorage.getItem('homeAddress');
      if (savedAddress) {
        try {
          const address = JSON.parse(savedAddress);
          set({ homeAddress: address });

          // Load assigned schools from cache first for immediate display
          const savedAssigned = localStorage.getItem('assignedSchools');
          if (savedAssigned) {
            set({ assignedSchools: JSON.parse(savedAssigned) });
          }

          // Fetch fresh assigned schools if we have coordinates
          if (address.coordinates && Array.isArray(address.coordinates) && address.coordinates.length === 2) {
            get().fetchAssignedSchools(address.coordinates[1], address.coordinates[0]);
          }
        } catch (e) {
          console.error('[useStore] Failed to load saved home address:', e);
        }
      }

      // Load lookup address
      const savedLookupAddress = localStorage.getItem('lookupAddress');
      if (savedLookupAddress) {
        try {
          const address = JSON.parse(savedLookupAddress);
          set({ lookupAddress: address });

          // Also fetch assigned schools for lookup address if no home address is set
          // This helps in the Admin view
          if (!get().homeAddress && address.coordinates && Array.isArray(address.coordinates) && address.coordinates.length === 2) {
            // Check cache for lookup address assigned schools too
            const savedAssigned = localStorage.getItem('assignedSchools');
            if (savedAssigned && !get().assignedSchools) {
              set({ assignedSchools: JSON.parse(savedAssigned) });
            }
            get().fetchAssignedSchools(address.coordinates[1], address.coordinates[0]);
          }
        } catch (e) {
          console.error('[useStore] Failed to load saved lookup address:', e);
        }
      }
    },

    setDriveLink: (link) => set({ driveLink: link }),

    setRoutes: (routes, schoolId = null) => {
      // Merge with cached coordinates first
      const routesWithCache = mergeCachedCoordinates(routes);

      // Assign unique colors to all routes, ensuring no color reuse
      const colorMap = assignUniqueColors(routesWithCache.map(r => ({ id: r.id || '' })));

      // Assign colors and calculate geocoding progress
      const routesWithColors = routesWithCache.map((route) => {
        const totalStops = route.stops.length;
        const geocodedStops = route.stops.filter(s => s.coordinates).length;

        return {
          ...route,
          // Preserve existing color if it's already set, otherwise assign a new one
          // This prevents color changes when routes are reloaded
          color: route.color && route.color !== '' ? route.color : (colorMap.get(route.id || '') || '#FF6B6B'),
          isSelected: false, // Selection is now derived from URL
          geocodingProgress: {
            total: totalStops,
            geocoded: geocodedStops,
            isGeocoding: false,
          },
        };
      });

      // Update routes and the school ID they belong to
      set({ 
        routes: routesWithColors,
        routesSchoolId: schoolId 
      });

      // Save to cache using debounced function to handle potential rapid updates
      debouncedSaveToCache();
    },

    clearRoutes: () => set({ routes: [], routesSchoolId: null }),

    setHomeAddress: (address) => {
      set({ homeAddress: address });
      // Save to localStorage
      localStorage.setItem('homeAddress', JSON.stringify(address));

      // Fetch assigned schools if we have coordinates
      if (address.coordinates && Array.isArray(address.coordinates) && address.coordinates.length === 2) {
        get().fetchAssignedSchools(address.coordinates[1], address.coordinates[0]);
      }
    },

    clearHomeAddress: () => {
      set({ homeAddress: undefined, assignedSchools: null });
      localStorage.removeItem('homeAddress');
      localStorage.removeItem('assignedSchools');
    },

    setLookupAddress: (address) => {
      set({ lookupAddress: address });
      // Save to localStorage
      localStorage.setItem('lookupAddress', JSON.stringify(address));

      // Fetch assigned schools for lookup address only if no home address is set
      if (!get().homeAddress && address.coordinates && Array.isArray(address.coordinates) && address.coordinates.length === 2) {
        get().fetchAssignedSchools(address.coordinates[1], address.coordinates[0]);
      }
    },

    clearLookupAddress: () => {
      set({ lookupAddress: undefined });
      localStorage.removeItem('lookupAddress');
      // Only clear assigned schools and its cache if no home address is set
      if (!get().homeAddress) {
        set({ assignedSchools: null });
        localStorage.removeItem('assignedSchools');
      }
    },

    setLoading: (loading) => set((state) => {
      const newCount = loading ? state.loadingCount + 1 : Math.max(0, state.loadingCount - 1);
      return {
        loadingCount: newCount,
        isLoading: newCount > 0,
        loadingProgress: newCount === 0 ? null : state.loadingProgress
      };
    }),

    setLoadingProgress: (progress) => set((state) => ({
      loadingProgress: progress,
      isLoading: progress !== null && progress < 100 || state.loadingCount > 0
    })),

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

        // Save to cache whenever coordinates are updated using debounced function
        // This prevents race conditions and redundant writes during bulk geocoding
        debouncedSaveToCache();

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

    setSchools: (schools) => set({ schools }),

    setMapIntent: (intent) => set({ mapIntent: intent }),

    setLastRouteNames: (names) => set({ lastRouteNames: names }),

    setLastDirection: (direction) => set({ lastDirection: direction }),

    setLastStopId: (stopId) => set({ lastStopId: stopId }),

    setLastFocus: (focus) => set({ lastFocus: focus }),

    toggleDarkMode: () => set((state) => {
      const next = !state.isDarkMode;
      localStorage.setItem('darkMode', String(next));
      return { isDarkMode: next };
    }),

    setIsDarkMode: (isDark) => {
      localStorage.setItem('darkMode', String(isDark));
      set({ isDarkMode: isDark });
    },

    fetchAssignedSchools: async (lat, lng) => {
      try {
        const assigned = await assignedSchoolsService.fetchAssignedSchools(lat, lng);
        if (assigned) {
          set({ assignedSchools: assigned });
          // Cache the result for persistence across refreshes
          localStorage.setItem('assignedSchools', JSON.stringify(assigned));
        }
      } catch (error) {
        console.error('[useStore] Error fetching assigned schools:', error);
        // Don't clear assignedSchools on fetch error if we already have cached ones
        // set({ assignedSchools: null });
      }
    },

    fetchBoundaries: async () => {
      try {
        const response = await fetch('/api/schools/boundaries');
        if (!response.ok) throw new Error('Failed to fetch boundaries');
        const data = await response.json();
        set({ boundaries: data.boundaries });
      } catch (error) {
        console.error('Error fetching boundaries:', error);
        set({ boundaries: null });
      }
    },

    toggleBoundaries: () => {
      const { showBoundaries, boundaries, fetchBoundaries } = get();
      if (!showBoundaries && !boundaries) {
        fetchBoundaries();
      }
      set({ showBoundaries: !showBoundaries });
    },

    toggleBoundaryType: (type) => {
      const key = `show${type.charAt(0).toUpperCase() + type.slice(1)}Boundaries` as keyof Store;
      const { boundaries, fetchBoundaries } = get();
      if (!boundaries) {
        fetchBoundaries();
      }
      set({ [key]: !get()[key] } as any);
    },

    toggleAllBoundaries: (show) => {
      const { boundaries, fetchBoundaries } = get();
      if (show && !boundaries) {
        fetchBoundaries();
      }
      set({
        showElementaryBoundaries: show,
        showMiddleBoundaries: show,
        showHighBoundaries: show
      });
    },

    setShowSchoolClosestModal: (show, data) => set({ 
      showSchoolClosestModal: show, 
      schoolClosestModalData: data || null 
    }),
  };
});
