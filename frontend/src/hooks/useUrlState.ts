import { useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { School, Route } from '../types';
import {
  parseUrlPath,
  buildUrlPath,
  slugToSchoolId,
  findRoutesByNumbers,
  findStopByNumber,
  urlToDirection,
  getRouteNumbers,
} from '../services/urlState';

interface UseUrlStateOptions {
  basePath?: string;
  schools: School[];
  routes: Route[];
  activeTab?: 'schools' | 'routes';
  debounceMs?: number;
}

/**
 * Hook to sync URL path with Zustand store state
 * Handles bidirectional sync: URL -> Store and Store -> URL
 * 
 * Key principle: URL -> Store only runs on actual URL changes (navigation)
 * Store -> URL runs on user interactions (debounced)
 */
export function useUrlState(options: UseUrlStateOptions) {
  const { basePath = '/bus-route-explorer', schools, routes, activeTab, debounceMs = 300 } = options;
  const navigate = useNavigate();
  const location = useLocation();
  const store = useStore();
  const {
    selectedSchoolId,
    selectedStop,
    directionFilter,
    setSelectedSchool,
    setDirectionFilter,
    selectStop,
    clearSelectedStop,
    toggleRouteSelection,
  } = store;

  // Track if we're updating from URL (to prevent circular updates)
  const isUpdatingFromUrlRef = useRef(false);
  const updateUrlTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastUserActionRef = useRef<number>(0);
  const storeRef = useRef({ routes, selectedSchoolId, selectedStop, directionFilter, schools });
  const locationPathnameRef = useRef(location.pathname);
  
  // Keep refs in sync with current state (without triggering re-runs)
  useEffect(() => {
    storeRef.current = { routes, selectedSchoolId, selectedStop, directionFilter, schools };
  }, [routes, selectedSchoolId, selectedStop, directionFilter, schools]);
  
  // Keep location pathname ref in sync
  useEffect(() => {
    locationPathnameRef.current = location.pathname;
  }, [location.pathname]);

  /**
   * Update store from URL path
   * ONLY runs when URL actually changes (navigation, back/forward)
   * Uses refs to access current store state without triggering re-runs
   */
  const updateStoreFromUrl = useCallback(() => {
    if (isUpdatingFromUrlRef.current) return;

    isUpdatingFromUrlRef.current = true;

    try {
      const parsed = parseUrlPath(location.pathname, basePath);
      const currentStore = storeRef.current;

      // Update school
      if (parsed.school) {
        const schoolId = slugToSchoolId(parsed.school, currentStore.schools);
        if (schoolId && schoolId !== currentStore.selectedSchoolId) {
          // Skip if we just had a user action (within last 500ms) - user might have just deselected
          const timeSinceUserAction = Date.now() - lastUserActionRef.current;
          if (timeSinceUserAction < 500) {
            console.log('[useUrlState] Skipping school update from URL - recent user action');
          } else {
            console.log('[useUrlState] Updating school from URL:', schoolId);
            setSelectedSchool(schoolId);
          }
        }
      } else if (currentStore.selectedSchoolId) {
        // URL has no school - clear it from store
        // Only skip clearing if we're explicitly in routes view (routes view needs school)
        // If parsed.show is null or 'schools', we should clear
        // Always clear when URL has no school (user closed dialog or navigated to base path)
        if (parsed.show !== 'routes') {
          console.log('[useUrlState] Clearing school (not in URL, show is not routes)');
          setSelectedSchool(null);
        }
      }

      // Update direction filter (only if routes are shown)
      if (parsed.show === 'routes' && parsed.time) {
        if (parsed.time !== currentStore.directionFilter) {
          console.log('[useUrlState] Updating direction filter from URL:', parsed.time);
          setDirectionFilter(parsed.time);
        }
      }

      // Update route selection (only if routes are shown)
      if (parsed.show === 'routes') {
        if (parsed.routes.length > 0) {
          const urlRouteNumbers = parsed.routes;
          const urlRoutes = findRoutesByNumbers(currentStore.routes, urlRouteNumbers);

          // Update route selection to match URL
          currentStore.routes.forEach(route => {
            const shouldBeSelected = urlRouteNumbers.includes(route.name);
            if (route.isSelected !== shouldBeSelected) {
              console.log('[useUrlState] Updating route selection:', route.name, shouldBeSelected);
              toggleRouteSelection(route.id);
            }
          });

          // Update selected stop only if URL explicitly specifies one
          if (parsed.stop && urlRoutes.length > 0) {
            // Try to find stop in the first matching route (or could be smarter about which route)
            // For now, use the first route that has enough stops
            const routeWithStop = urlRoutes.find(r => r.stops.length >= parsed.stop!);
            if (routeWithStop) {
              const stop = findStopByNumber(routeWithStop, parsed.stop);
              if (stop) {
                const currentStopId = currentStore.selectedStop?.stop.id;
                if (currentStopId !== stop.id) {
                  console.log('[useUrlState] Updating selected stop from URL:', routeWithStop.name, parsed.stop);
                  selectStop(routeWithStop, stop, parsed.stop);
                }
              }
            }
          }
          // Don't clear stop if URL has routes but no stop - user might have just selected a route
          // Only clear if URL explicitly shows we're not in routes view
        }
        // If URL shows routes but no routes specified, don't clear anything - let user interact
      }
      // Don't clear stop when switching views - let user interactions handle it
      // URL sync should only SET state from URL, not clear user selections
    } catch (error) {
      console.error('[useUrlState] Error updating store from URL:', error);
    } finally {
      isUpdatingFromUrlRef.current = false;
    }
  }, [
    location.pathname,
    basePath,
    setSelectedSchool,
    setDirectionFilter,
    selectStop,
    clearSelectedStop,
    toggleRouteSelection,
  ]);

  /**
   * Update URL from store state
   * Runs when user interacts (store changes)
   * Debounced to avoid too many URL updates
   */
  const updateUrlFromStore = useCallback(() => {
    if (isUpdatingFromUrlRef.current) return;

    // Mark that user just acted (to prevent URL sync from overriding)
    lastUserActionRef.current = Date.now();

    // Clear any pending URL update
    if (updateUrlTimeoutRef.current) {
      clearTimeout(updateUrlTimeoutRef.current);
    }

    // Debounce URL updates
    updateUrlTimeoutRef.current = setTimeout(() => {
      try {
        const currentStore = storeRef.current;
        
        // Use activeTab if provided, otherwise infer from routes
        const hasSelectedRoutes = currentStore.routes.some(r => r.isSelected);
        const show: 'schools' | 'routes' = activeTab || (hasSelectedRoutes ? 'routes' : 'schools');

        const routeNumbers = show === 'routes' && hasSelectedRoutes ? getRouteNumbers(currentStore.routes) : '';

        const newPath = buildUrlPath(
          basePath,
          {
            school: currentStore.selectedSchoolId,
            show: show,
            routes: routeNumbers ? routeNumbers.split(',') : [],
            time: currentStore.directionFilter,
            stop: currentStore.selectedStop ? currentStore.selectedStop.stopNumber : null,
          },
          currentStore.schools
        );

        // Only update if path actually changed (use ref to get latest pathname)
        if (newPath !== locationPathnameRef.current) {
          console.log('[useUrlState] Updating URL from store:', newPath);
          navigate(newPath, { replace: true });
        }
      } catch (error) {
        console.error('[useUrlState] Error updating URL from store:', error);
      }
    }, debounceMs);
  }, [
    basePath,
    location.pathname,
    navigate,
    debounceMs,
    activeTab,
  ]);

  // Update store from URL ONLY when URL actually changes (navigation, back/forward)
  useEffect(() => {
    updateStoreFromUrl();
  }, [location.pathname, basePath, updateStoreFromUrl]);

  // Update URL from store when user interacts (store state changes)
  useEffect(() => {
    updateUrlFromStore();
  }, [routes, selectedSchoolId, selectedStop, directionFilter, activeTab, updateUrlFromStore]);

  return {
    updateStoreFromUrl,
    updateUrlFromStore,
  };
}

