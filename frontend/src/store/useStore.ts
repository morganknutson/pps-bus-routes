import { create } from 'zustand';
import { AppState, Route, HomeAddress, School, Stop, MapIntent } from '../types';
import { assignUniqueColors } from '../utils/colorGenerator';
import { saveRoutesToCache, mergeCachedCoordinates } from '../services/routeCache';
import { validateLngLat } from '../utils/coordinates';
import { debounce } from '../utils/debounce';

interface Store extends AppState {
  initialize: (options?: { skipSchoolSelection?: boolean }) => void;
  setDriveLink: (link: string) => void;
  setRoutes: (routes: Route[]) => void;
  toggleRouteSelection: (routeId: string) => void;
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
  setSelectedSchool: (schoolId: string | null) => void;
  setSchools: (schools: School[]) => void;
  setSelectedRoutes: (routeIds: string[]) => void;
  selectStop: (route: Route, stop: Stop, stopNumber: number) => void;
  clearSelectedStop: () => void;
  setDirectionFilter: (direction: 'Morning' | 'Afternoon' | 'Both') => void;
  triggerZoomToHomeAddress: () => void;
  clearZoomToHomeAddress: () => void;
  toggleDarkMode: () => void;
  setIsDarkMode: (isDark: boolean) => void;
  activeTab: 'schools' | 'routes' | 'neighborhoods';
  setActiveTab: (tab: 'schools' | 'routes' | 'neighborhoods') => void;
  setMapIntent: (intent: MapIntent | null) => void;
  mapIntent: MapIntent | null;
  currentGeocodingRouteId: string | null;
  selectedStop: { route: Route; stop: Stop; stopNumber: number } | null;
  directionFilter: 'Morning' | 'Afternoon' | 'Both';
  lookupAddress: HomeAddress | undefined;
  shouldZoomToHomeAddress: boolean;
  loadingCount: number;
  loadingProgress: number | null; // 0-100 or null for indeterminate
  assignedSchools: import('../types').AssignedSchools | null;
  fetchAssignedSchools: (lat: number, lng: number) => Promise<void>;
  boundaries: any[] | null;
  showBoundaries: boolean;
  fetchBoundaries: () => Promise<void>;
  toggleBoundaries: () => void;
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
    homeAddress: undefined,
    lookupAddress: undefined,
    isLoading: false,
    loadingCount: 0,
    loadingProgress: null as number | null, // 0-100 or null for indeterminate
    error: undefined,
    selectedSchoolId: null,
    schools: [],
    currentGeocodingRouteId: null,
    selectedStop: null,
    directionFilter: 'Morning',
    activeTab: 'schools',
    mapIntent: null,
    shouldZoomToHomeAddress: false,
    assignedSchools: null,
    boundaries: null,
    showBoundaries: false,
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
          // Trigger zoom on initial load if address is present
          set({ shouldZoomToHomeAddress: true });
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
        } catch (e) {
          console.error('[useStore] Failed to load saved lookup address:', e);
        }
      }

      // Load selected school (but only if not already set by URL logic and not skipped)
      if (!options?.skipSchoolSelection) {
        const currentSchoolId = get().selectedSchoolId;
        if (!currentSchoolId) {
          const savedSchoolId = localStorage.getItem('selectedSchoolId');
          if (savedSchoolId) {
            set({ selectedSchoolId: savedSchoolId });
          }
        }
      }
    },

    setDriveLink: (link) => set({ driveLink: link }),

    setRoutes: (routes) => {
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
          isSelected: route.isSelected ?? false,
          geocodingProgress: {
            total: totalStops,
            geocoded: geocodedStops,
            isGeocoding: false,
          },
        };
      });

      // Update routes and clear selectedStop if there are no routes to show
      set((state) => {
        const shouldClearSelectedStop = routesWithColors.length === 0 && state.selectedStop;

        // Update selectedStop's route if it exists and matches one of the new routes
        // This ensures the selected stop always has the latest route data (including colors)
        let updatedSelectedStop = state.selectedStop;
        if (updatedSelectedStop && !shouldClearSelectedStop) {
          const matchingRoute = routesWithColors.find(r => r.id === updatedSelectedStop!.route.id);
          if (matchingRoute) {
            updatedSelectedStop = {
              ...updatedSelectedStop,
              route: matchingRoute
            };
          }
        }

        return {
          routes: routesWithColors,
          selectedStop: shouldClearSelectedStop ? null : updatedSelectedStop,
        };
      });

      // Save to cache using debounced function to handle potential rapid updates
      debouncedSaveToCache();
    },

    toggleRouteSelection: (routeId) =>
      set((state) => {
        const updatedRoutes = state.routes.map((route) =>
          route.id === routeId
            ? { ...route, isSelected: !route.isSelected }
            : route
        );

        let updatedSelectedStop = state.selectedStop;
        const routeBeingToggled = state.routes.find((route) => route.id === routeId);
        const isCurrentlySelected = routeBeingToggled?.isSelected; // State before toggle
        const isTurningOn = !isCurrentlySelected; // If it wasn't selected, we are turning it ON

        // If the route is currently selected and is being turned off, clear the selected stop for that route
        if (isCurrentlySelected && state.selectedStop && state.selectedStop.route.id === routeId) {
          console.log('[useStore] Route deselected, clearing selected stop');
          updatedSelectedStop = null;
        }

        // Fix for "My Stop" state persistence:
        // If we are turning a route ON, and we constitute a "My Stop" view (DOUBLE_FIT),
        // we should clear the specific stop focus so the map can show the new route(s).
        let newMapIntent = state.mapIntent;
        if (isTurningOn && state.mapIntent?.type === 'DOUBLE_FIT') {
          console.log('[useStore] Route selected while in DOUBLE_FIT, clearing selected stop and fitting routes');
          updatedSelectedStop = null;
          newMapIntent = { type: 'FIT_ROUTES' };
        }

        return {
          routes: updatedRoutes,
          selectedStop: updatedSelectedStop,
          mapIntent: newMapIntent
        };
      }),

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

    setSelectedSchool: (schoolId) => {
      // When the selected school changes, clear routes and selected stop
      // to avoid race conditions where old school data is synced to the new school's URL.
      set((state) => {
        // Only clear if the school actually changed
        if (state.selectedSchoolId === schoolId) {
          return state;
        }

        console.log('[useStore] School changing to:', schoolId, 'clearing previous routes and stops');

        return {
          selectedSchoolId: schoolId,
          selectedStop: null,
          routes: [], // Clear routes immediately to prevent URL sync issues
          // Tab switching is now handled by the UI components/URL logic explicitly
        };
      });
      // Save to localStorage
      if (schoolId) {
        localStorage.setItem('selectedSchoolId', schoolId);
      } else {
        localStorage.removeItem('selectedSchoolId');
      }
    },

    setSchools: (schools) => set({ schools }),

    setSelectedRoutes: (routeIds) =>
      set((state) => {
        console.log('[useStore] Setting selected routes:', routeIds);
        const updatedRoutes = state.routes.map((route) => {
          const isSelected = routeIds.includes(route.id);
          return route.isSelected === isSelected ? route : { ...route, isSelected };
        });

        // Clear selected stop if its route is no longer selected
        let updatedSelectedStop = state.selectedStop;
        if (state.selectedStop && !routeIds.includes(state.selectedStop.route.id)) {
          console.log('[useStore] Clearing selected stop because its route was deselected');
          updatedSelectedStop = null;
        }

        return {
          routes: updatedRoutes,
          selectedStop: updatedSelectedStop,
        };
      }),

    selectStop: (route, stop, stopNumber) => set((state) => {
      // Ensure we use the route object from the store that has the color assigned
      const routeWithColor = state.routes.find(r => r.id === route.id) || route;

      // Auto-select the route when a stop is selected so it appears on the map
      const updatedRoutes = state.routes.map(r =>
        r.id === route.id ? { ...r, isSelected: true } : r
      );

      return {
        routes: updatedRoutes,
        selectedStop: {
          route: routeWithColor,
          stop,
          stopNumber
        }
      };
    }),

    clearSelectedStop: () => set({ selectedStop: null }),

    setDirectionFilter: (direction) => {
      set((state) => {
        if (state.directionFilter === direction) return state;

        const oldDirection = state.directionFilter;
        const newDirection = direction;

        // 1. Carry over route selection (by name) from old direction to new direction
        // Find names of currently selected routes in the OLD context
        const selectedNames = state.routes
          .filter(r => r.isSelected && (oldDirection === 'Both' || r.direction === oldDirection))
          .map(r => r.name);

        // Update routes: 
        // Ensure the selection in the NEW context exactly matches the names from the OLD context.
        const updatedRoutes = state.routes.map(r => {
          const isCurrentContext = newDirection === 'Both' || r.direction === newDirection;

          if (isCurrentContext) {
            const shouldBeSelected = selectedNames.includes(r.name);
            if (r.isSelected !== shouldBeSelected) {
              return { ...r, isSelected: shouldBeSelected };
            }
          }
          return r;
        });

        // 2. Try to carry over stop selection if it exists
        let updatedSelectedStop = state.selectedStop;
        if (state.selectedStop && oldDirection !== newDirection) {
          const currentStop = state.selectedStop.stop;
          const currentRouteName = state.selectedStop.route.name;

          // Look for the same route in the NEW direction
          const newTargetRoute = updatedRoutes.find(r =>
            r.name === currentRouteName &&
            (newDirection === 'Both' || r.direction === newDirection)
          );

          if (newTargetRoute) {
            // Try to find the matching stop by address
            const matchingStopIndex = newTargetRoute.stops.findIndex(s => s.address === currentStop.address);
            if (matchingStopIndex !== -1) {
              const matchingStop = newTargetRoute.stops[matchingStopIndex];
              updatedSelectedStop = {
                route: newTargetRoute,
                stop: matchingStop,
                stopNumber: matchingStopIndex + 1
              };
            } else {
              // If no exact address match, we might want to clear it or keep it?
              // Usually best to clear if it's not the same physical location
              updatedSelectedStop = null;
            }
          } else {
            updatedSelectedStop = null;
          }
        }

        return {
          directionFilter: direction,
          routes: updatedRoutes,
          selectedStop: updatedSelectedStop
        };
      });
    },

    triggerZoomToHomeAddress: () => set({ shouldZoomToHomeAddress: true }),
    clearZoomToHomeAddress: () => set({ shouldZoomToHomeAddress: false }),

    setActiveTab: (tab) => set({ activeTab: tab }),

    setMapIntent: (intent) => set({ mapIntent: intent }),

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
        const response = await fetch(`/api/schools/assigned?lat=${lat}&lng=${lng}`);
        if (!response.ok) throw new Error('Failed to fetch assigned schools');
        const data = await response.json();
        set({ assignedSchools: data.assigned });
      } catch (error) {
        console.error('Error fetching assigned schools:', error);
        set({ assignedSchools: null });
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
  };
});
