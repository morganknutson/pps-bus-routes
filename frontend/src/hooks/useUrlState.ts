import { useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { School, Route } from '../types';
import { parseUrlPath, buildUrlPath, UrlState } from '../services/urlState';
import { useStore } from '../store/useStore';

interface UseUrlStateOptions {
  basePath: string;
  schools: School[];
  routes: Route[];
  activeTab: 'schools' | 'routes';
  setActiveTab: (tab: 'schools' | 'routes') => void;
  debounceMs?: number;
}

interface UseUrlStateReturn {
  cancelPendingUrlUpdate: () => void;
  markRouteToggle: (routeId: string) => void;
}

/**
 * Hook to sync URL state with application state
 * Updates URL when:
 * - School selection changes
 * - Active tab changes
 * - Route selection changes
 * 
 * Also syncs application state from URL on mount and when URL changes
 */
export function useUrlState({
  basePath,
  schools,
  routes,
  activeTab,
  setActiveTab,
  debounceMs = 300,
}: UseUrlStateOptions): UseUrlStateReturn {
  const navigate = useNavigate();
  const location = useLocation();
  const { 
    selectedSchoolId, 
    setSelectedSchool, 
    toggleRouteSelection, 
    setSelectedRoutes,
    directionFilter, 
    setDirectionFilter,
    selectedStop,
    selectStop,
    clearSelectedStop
  } = useStore();
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastUrlStateRef = useRef<UrlState>({});
  const previousRoutesRef = useRef<Route[]>([]);
  const isNavigatingRef = useRef(false);
  const hasSyncedFromUrlRef = useRef(false);

  // Cancel any pending URL update
  const cancelPendingUrlUpdate = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
  }, []);

  // Update URL from current state (debounced)
  const updateUrlFromState = useCallback((immediate = false) => {
    // CRITICAL: If we haven't finished syncing the initial URL into the store yet,
    // don't build a new URL from the store's partial state. This prevents 
    // overwriting complex deep links with truncated versions while data is loading.
    if (!hasSyncedFromUrlRef.current) {
      console.log('[useUrlState] Skipping URL update: initial sync from URL in progress');
      return;
    }

    cancelPendingUrlUpdate();

    const performUpdate = () => {
      // Get latest state directly from store to avoid closure issues
      const state = useStore.getState();
      const currentRoutes = state.routes;
      const currentSelectedStop = state.selectedStop;
      const currentDirectionFilter = state.directionFilter;
      const currentSelectedSchoolId = state.selectedSchoolId;

      const urlState: UrlState = {
        show: activeTab,
      };

      if (currentSelectedSchoolId) {
        urlState.schoolId = currentSelectedSchoolId;
        
        if (activeTab === 'routes') {
          urlState.direction = currentDirectionFilter.toLowerCase() as 'morning' | 'afternoon' | 'both';
          
          const selectedRouteNames = currentRoutes
            .filter(r => r.isSelected && (currentDirectionFilter === 'Both' || r.direction === currentDirectionFilter))
            .map(r => r.name)
            .filter((name): name is string => !!name);
          
          if (selectedRouteNames.length > 0) {
            urlState.routeNames = selectedRouteNames;
            
            if (currentSelectedStop) {
              const routeName = currentSelectedStop.route.name;
              const stopId = currentSelectedStop.stop.id;
              const stopMatch = stopId.match(/stop-(\d+)/);
              const stopNumber = stopMatch ? stopMatch[1] : stopId;
              
              if (routeName.endsWith('-upcoming')) {
                const baseName = routeName.replace('-upcoming', '');
                urlState.stopId = `${baseName}-${stopNumber}-upcoming`;
              } else {
                urlState.stopId = `${routeName}-${stopNumber}`;
              }
            }
          }
        }
      }

      const newPath = buildUrlPath(basePath, urlState);
      const currentPath = window.location.pathname.replace(/\/$/, '') || '/';
      const normalizedNewPath = newPath.replace(/\/$/, '') || '/';

      if (normalizedNewPath !== currentPath) {
        // If we are about to navigate, mark that we are in sync or about to be
        hasSyncedFromUrlRef.current = true;
        console.log(`[useUrlState] ${immediate ? 'Sync' : 'Debounced'} URL update from state:`, normalizedNewPath);
        isNavigatingRef.current = true;
        navigate(newPath, { replace: true });
      }
    };

    if (immediate) {
      performUpdate();
    } else {
      debounceTimerRef.current = setTimeout(performUpdate, debounceMs);
    }
  }, [basePath, activeTab, routes, navigate, debounceMs, cancelPendingUrlUpdate]);

  // Sync state from URL
  useEffect(() => {
    const urlState = parseUrlPath(location.pathname, basePath);
    const previousUrlState = lastUrlStateRef.current;
    lastUrlStateRef.current = urlState;
    
    const isFirstRoutesLoad = previousRoutesRef.current.length === 0 && routes.length > 0;
    previousRoutesRef.current = routes;

    // If we just navigated from state, ignore this URL change
    if (isNavigatingRef.current) {
      console.log('[useUrlState] Ignoring URL change: just navigated from state');
      isNavigatingRef.current = false;
      hasSyncedFromUrlRef.current = true; // We are definitely in sync now
      return;
    }

    // Only sync if URL actually changed OR if routes just loaded
    const urlChanged = JSON.stringify(urlState) !== JSON.stringify(previousUrlState);
    
    // Check if only direction changed and a stop is selected
    const directionChanged = urlState.direction !== previousUrlState.direction;
    
    if (!urlChanged && !isFirstRoutesLoad) {
      return;
    }

    // We are starting a sync from URL, so block any sync TO URL until we are done
    if (urlChanged || isFirstRoutesLoad) {
      console.log('[useUrlState] Starting sync from URL, blocking sync back to URL');
      hasSyncedFromUrlRef.current = false;
    }

    console.log('[useUrlState] Syncing state from URL:', location.pathname, urlState, { 
      isFirstRoutesLoad, 
      urlChanged,
      currentStoreSchoolId: selectedSchoolId,
      currentStoreTab: activeTab
    });

    try {
      // 0. Sync tab selection
      if (urlState.show && urlState.show !== activeTab) {
        setActiveTab(urlState.show);
      }

      // 1. Sync school selection
      if (urlState.schoolId) {
        // Try to find the school in our loaded list
        const school = schools.find(s => s.id.toLowerCase() === urlState.schoolId?.toLowerCase());
        
        // Determine if we have a mismatch that needs syncing
        // If we found the school, we want the store to match its official ID
        // If schools haven't loaded yet, we just want it to match the URL string
        const hasIdMismatch = school 
          ? selectedSchoolId?.toLowerCase() !== school.id.toLowerCase()
          : selectedSchoolId?.toLowerCase() !== urlState.schoolId.toLowerCase();

        if (hasIdMismatch) {
          if (school) {
            console.log('[useUrlState] Syncing school from URL (with school list):', school.id);
            setSelectedSchool(school.id);
          } else if (schools.length === 0) {
            // CRITICAL: Trust the URL ID even if schools haven't loaded yet
            // This prevents the store->URL sync from overwriting the URL with an empty state
            console.log('[useUrlState] Syncing school from URL (pre-loading schools):', urlState.schoolId);
            setSelectedSchool(urlState.schoolId);
          }
        }
      } else if (!urlState.schoolId && selectedSchoolId) {
        console.log('[useUrlState] URL has no school, clearing selection');
        setSelectedSchool(null);
      }

      // 2. Sync direction filter
      if (urlState.direction) {
        const newDir = urlState.direction === 'morning' ? 'Morning' : 
                      urlState.direction === 'afternoon' ? 'Afternoon' : 'Both';
        if (directionFilter !== newDir) {
          setDirectionFilter(newDir);
        }
      }

      // 3. Sync route selection
      // If we have route names in URL, enforce them strictly.
      if (urlState.routeNames && urlState.routeNames.length > 0 && routes.length > 0) {
        // Find routes that match the names in URL AND direction
        const routesToSelect = routes.filter(r => {
          const nameMatches = urlState.routeNames!.includes(r.name);
          const directionMatches = urlState.direction === 'both' || !r.direction || r.direction?.toLowerCase() === urlState.direction;
          return nameMatches && directionMatches;
        });
        
        const otherDirectionSelectedIds = routes
          .filter(r => r.isSelected && r.direction?.toLowerCase() !== urlState.direction && urlState.direction !== 'both')
          .map(r => r.id);
          
        const targetRouteIds = [
          ...otherDirectionSelectedIds,
          ...routesToSelect.map(r => r.id)
        ];

        console.log('[useUrlState] Enforcing route selection from URL:', targetRouteIds);
        setSelectedRoutes(targetRouteIds);

        // 4. Sync stop selection
        if (urlState.stopId) {
          let routeName = '';
          let stopNum = '';
          
          // Handle both {route}-{stop} and {route}-{stop}-upcoming
          const isUpcoming = urlState.stopId.endsWith('-upcoming');
          const cleanStopId = isUpcoming ? urlState.stopId.replace('-upcoming', '') : urlState.stopId;
          const lastDashIndex = cleanStopId.lastIndexOf('-');
          
          if (lastDashIndex !== -1) {
            const routeBase = cleanStopId.substring(0, lastDashIndex);
            stopNum = cleanStopId.substring(lastDashIndex + 1);
            routeName = isUpcoming ? `${routeBase}-upcoming` : routeBase;
          }

          if (routeName && stopNum) {
            const stopIdToFind = stopNum.startsWith('stop-') ? stopNum : `stop-${stopNum}`;
            const targetRoute = routesToSelect.find(r => r.name === routeName);
            
            if (targetRoute) {
              const stopIndex = targetRoute.stops.findIndex(s => s.id === stopIdToFind);
              if (stopIndex !== -1) {
                const stop = targetRoute.stops[stopIndex];
                if (!selectedStop || selectedStop.stop.id !== stop.id || selectedStop.route.id !== targetRoute.id) {
                  console.log('[useUrlState] Selecting stop from URL:', urlState.stopId);
                  selectStop(targetRoute, stop, stopIndex + 1);
                }
              }
            }
          }
        } else if (selectedStop && !directionChanged) {
          // Clear stop ONLY if URL has no stop and direction hasn't changed
          // If direction DID change, the store's setDirectionFilter handled the transition
          clearSelectedStop();
        }
      } else if (urlState.schoolId && urlState.show === 'routes' && routes.length > 0) {
        // URL targets routes tab but specifies NO specific route names.
        // Default to "select all" for the current direction ONLY if nothing is selected yet.
        const effectiveDirection = urlState.direction || directionFilter.toLowerCase();
        const hasAnySelectedForDir = routes.some(r => 
          r.isSelected && (effectiveDirection === 'both' || r.direction?.toLowerCase() === effectiveDirection)
        );
        
        if (!hasAnySelectedForDir && (urlChanged || isFirstRoutesLoad)) {
          console.log('[useUrlState] No routes selected for direction, defaulting to all');
          const idsToSelect = routes
            .filter(r => effectiveDirection === 'both' || !r.direction || r.direction?.toLowerCase() === effectiveDirection)
            .map(r => r.id);
          
          const otherDirectionSelectedIds = routes
            .filter(r => r.isSelected && r.direction?.toLowerCase() !== effectiveDirection && effectiveDirection !== 'both')
            .map(r => r.id);
          
          setSelectedRoutes([...idsToSelect, ...otherDirectionSelectedIds]);
        }
      } else if (urlState.schoolId && urlState.show === 'schools' && routes.length > 0 && urlChanged) {
        // URL targets schools tab - clear any route selections to match the state
        const anySelected = routes.some(r => r.isSelected);
        if (anySelected) {
          console.log('[useUrlState] URL changed to schools tab, clearing route selection');
          setSelectedRoutes([]);
          clearSelectedStop();
        }
      }

      // Mark as synced if we've processed the URL completely
      // If there are routes/stops in the URL, we aren't "synced" until routes are loaded
      const hasRoutesInUrl = !!urlState.routeNames;
      const routesReady = routes.length > 0;
      
      if (!hasRoutesInUrl || routesReady) {
        console.log('[useUrlState] Sync from URL complete, unblocking sync back to URL');
        hasSyncedFromUrlRef.current = true;
      }
    } catch (error) {
      console.error('[useUrlState] Error syncing state from URL:', error);
      hasSyncedFromUrlRef.current = true; // Unblock on error to avoid being stuck
    }
  }, [location.pathname, basePath, schools, routes, selectedSchoolId, setSelectedSchool, setSelectedRoutes, directionFilter, setDirectionFilter, selectedStop, selectStop, clearSelectedStop, activeTab, setActiveTab]);

  // Update URL when state changes
  useEffect(() => {
    // We always want the URL to reflect the latest state.
    // If it's a structural change (school or tab), we do it immediately.
    // Otherwise (routes/stops), we debounce to avoid spamming the history.
    
    const currentUrlState = parseUrlPath(window.location.pathname, basePath);
    const schoolChanged = selectedSchoolId?.toLowerCase() !== currentUrlState.schoolId?.toLowerCase();
    const tabChanged = activeTab !== currentUrlState.show;
    
    if (schoolChanged || tabChanged) {
      updateUrlFromState(true); // Immediate update
    } else {
      updateUrlFromState(); // Debounced update
    }
    
    return () => {
      cancelPendingUrlUpdate();
    };
  }, [updateUrlFromState, cancelPendingUrlUpdate, selectedSchoolId, activeTab, routes, selectedStop, directionFilter, basePath]);

  const markRouteToggle = useCallback(() => {
    // This is called when a route is toggled in the UI.
    updateUrlFromState();
  }, [updateUrlFromState]);

  return {
    cancelPendingUrlUpdate,
    markRouteToggle,
  };
}
