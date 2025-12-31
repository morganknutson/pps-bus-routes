import { useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { School, Route, MapIntent } from '../types';
import { parseUrlPath, buildUrlPath, UrlState } from '../services/urlState';
import { useStore } from '../store/useStore';

interface UseUrlStateOptions {
  basePath: string;
  schools: School[];
  routes: Route[];
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
  debounceMs = 300,
}: UseUrlStateOptions): UseUrlStateReturn {
  const navigate = useNavigate();
  const location = useLocation();
  const { 
    selectedSchoolId, 
    setSelectedSchool, 
    activeTab,
    setActiveTab,
    toggleRouteSelection, 
    setSelectedRoutes,
    directionFilter, 
    setDirectionFilter,
    selectedStop,
    selectStop,
    clearSelectedStop,
    setMapIntent,
    mapIntent
  } = useStore();
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastUrlStateRef = useRef<UrlState>({});
  const previousRoutesRef = useRef<Route[]>([]);
  const previousSelectedRouteIdsRef = useRef<string[]>([]);
  const previousSelectedStopIdRef = useRef<string | undefined>(undefined);
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
      const currentActiveTab = state.activeTab;
      const currentMapIntent = state.mapIntent;

      const urlState: UrlState = {
        show: currentActiveTab,
      };

      if (currentSelectedSchoolId) {
        urlState.schoolId = currentSelectedSchoolId;
        
        if (currentActiveTab === 'routes') {
          urlState.direction = currentDirectionFilter.toLowerCase() as 'morning' | 'afternoon' | 'both';
          
          const selectedRouteNames = currentRoutes
            .filter(r => r.isSelected && (currentDirectionFilter === 'Both' || r.direction === currentDirectionFilter))
            .map(r => r.name)
            .filter((name): name is string => !!name);
          
          // Check if route selection changed from what's in the current URL
          // This check is used both for stopId and focus preservation
          const currentUrlState = parseUrlPath(window.location.pathname, basePath);
          const urlRouteNames = currentUrlState.routeNames || [];
          const routeSelectionChanged = JSON.stringify(urlRouteNames.sort()) !== JSON.stringify(selectedRouteNames.sort());
          
          if (selectedRouteNames.length > 0) {
            urlState.routeNames = selectedRouteNames;
            
          // Only preserve stopId if:
          // 1. There's a selected stop
          // 2. The selected stop's route is still in the selected routes
          if (currentSelectedStop) {
            const routeName = currentSelectedStop.route.name;
            const stopRouteIsSelected = selectedRouteNames.includes(routeName);
            
            if (stopRouteIsSelected) {
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
      }

      // Handle focus/intent in URL
      if (currentMapIntent) {
        // Reuse route selection change check if we're on routes tab
        let routeSelectionChanged = false;
        if (currentActiveTab === 'routes') {
          const currentUrlState = parseUrlPath(window.location.pathname, basePath);
          const urlRouteNames = currentUrlState.routeNames || [];
          const currentRouteNames = currentRoutes
            .filter(r => r.isSelected && (currentDirectionFilter === 'Both' || r.direction === currentDirectionFilter))
            .map(r => r.name)
            .sort();
          routeSelectionChanged = JSON.stringify(urlRouteNames.sort()) !== JSON.stringify(currentRouteNames);
        }
        
        if (currentMapIntent.type === 'ZOOM_SCHOOL' && currentMapIntent.data?.showInfo) {
          urlState.focus = 'school-info';
        } else if (currentMapIntent.type === 'FIT_HOME') {
          urlState.focus = 'home';
        } else if (currentMapIntent.type === 'DOUBLE_FIT' && currentSelectedStop) {
          // Only preserve 'my-stop' focus if there's actually a selected stop.
          // We removed the routeSelectionChanged check here to allow the focus 
          // to be preserved during the initial "Find My Stop" action which changes routes.
          urlState.focus = 'my-stop';
        } else if (currentMapIntent.type === 'MANUAL' && currentMapIntent.data) {
          urlState.focus = `${currentMapIntent.data.lat},${currentMapIntent.data.lng},${currentMapIntent.data.zoom}`;
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
  }, [basePath, routes, navigate, debounceMs, cancelPendingUrlUpdate, mapIntent]);

  // Sync state from URL
  useEffect(() => {
    const urlState = parseUrlPath(location.pathname, basePath);
    const previousUrlState = lastUrlStateRef.current;
    lastUrlStateRef.current = urlState;
    
    const isFirstRoutesLoad = previousRoutesRef.current.length === 0 && routes.length > 0;
    previousRoutesRef.current = routes;

    // 5. Sync Map Intent
    const focusKeywords = ['school-info', 'home', 'my-stop'];
    const isCoords = (s: string) => /^-?\d+\.?\d*,-?\d+\.?\d*,\d+$/.test(s || '');
    
    let intent: MapIntent | null = null;
    
    if (urlState.focus === 'school-info') {
      intent = { type: 'ZOOM_SCHOOL', data: { schoolId: urlState.schoolId, showInfo: true } };
    } else if (urlState.focus === 'home') {
      intent = { type: 'FIT_HOME', data: { showInfo: true } };
    } else if (urlState.focus === 'my-stop') {
      intent = { type: 'DOUBLE_FIT' };
    } else if (urlState.stopId) {
      intent = { type: 'ZOOM_STOP', data: { stopId: urlState.stopId, showInfo: true } };
    } else if (urlState.focus && isCoords(urlState.focus)) {
      const parts = urlState.focus.split(',');
      if (parts.length === 3) {
        const [lat, lng, zoom] = parts.map(Number);
        if (!isNaN(lat) && !isNaN(lng) && !isNaN(zoom)) {
          intent = { type: 'MANUAL', data: { lat, lng, zoom } };
        }
      }
    } else if (urlState.show === 'routes' && urlState.schoolId) {
      if (urlState.routeNames && urlState.routeNames.length > 0) {
        intent = { type: 'FIT_ROUTES' };
      } else if (routes.length > 0) {
        intent = { type: 'ZOOM_SCHOOL', data: { schoolId: urlState.schoolId } };
      }
    } else if (urlState.schoolId && urlState.show === 'schools') {
      intent = { type: 'ZOOM_SCHOOL', data: { schoolId: urlState.schoolId } };
    } else if (urlState.show === 'schools' || !urlState.schoolId) {
      intent = { type: 'FIT_SCHOOLS' };
    }

    if (intent) {
      const currentIntent = useStore.getState().mapIntent;
      if (JSON.stringify(intent) !== JSON.stringify(currentIntent)) {
        console.log('[useUrlState] Derived map intent from URL:', intent);
        setMapIntent(intent);
      }
    } else {
      const currentIntent = useStore.getState().mapIntent;
      if (currentIntent !== null) {
        setMapIntent(null);
      }
    }

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
        const hasIdMismatch = school 
          ? selectedSchoolId?.toLowerCase() !== school.id.toLowerCase()
          : selectedSchoolId?.toLowerCase() !== urlState.schoolId.toLowerCase();

        if (hasIdMismatch) {
          if (school) {
            console.log('[useUrlState] Syncing school from URL (with school list):', school.id);
            setSelectedSchool(school.id);
          } else if (schools.length === 0) {
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
      if (urlState.routeNames && urlState.routeNames.length > 0 && routes.length > 0) {
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
        ].sort();

        const currentSelectedRouteIds = routes.filter(r => r.isSelected).map(r => r.id).sort();

        if (JSON.stringify(targetRouteIds) !== JSON.stringify(currentSelectedRouteIds)) {
          console.log('[useUrlState] Enforcing route selection from URL:', targetRouteIds);
          setSelectedRoutes(targetRouteIds);
        }

        // 4. Sync stop selection
        if (urlState.stopId) {
          let routeName = '';
          let stopNum = '';
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
                const isAlreadySelected = selectedStop?.stop.id === stop.id && selectedStop?.route.id === targetRoute.id;
                if (!isAlreadySelected) {
                  console.log('[useUrlState] Selecting stop from URL:', urlState.stopId);
                  selectStop(targetRoute, stop, stopIndex + 1);
                }
              }
            }
          }
        } else if (selectedStop && !directionChanged) {
          clearSelectedStop();
        }
      } else if (urlState.schoolId && urlState.show === 'routes' && routes.length > 0) {
        const effectiveDirection = urlState.direction || directionFilter.toLowerCase();
        const hasAnySelectedForDir = routes.some(r => 
          r.isSelected && (effectiveDirection === 'both' || r.direction?.toLowerCase() === effectiveDirection)
        );
        
        if (!hasAnySelectedForDir && (urlChanged || isFirstRoutesLoad)) {
          const idsToSelect = routes
            .filter(r => effectiveDirection === 'both' || !r.direction || r.direction?.toLowerCase() === effectiveDirection)
            .map(r => r.id);
          
          const otherDirectionSelectedIds = routes
            .filter(r => r.isSelected && r.direction?.toLowerCase() !== effectiveDirection && effectiveDirection !== 'both')
            .map(r => r.id);
          
          setSelectedRoutes([...idsToSelect, ...otherDirectionSelectedIds]);
        }
      } else if (urlState.schoolId && urlState.show === 'schools' && routes.length > 0 && urlChanged) {
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
      const routesReady = routes.length > 0 || (schools.length > 0 && selectedSchoolId && !useStore.getState().isLoading);
      
      if (!hasRoutesInUrl || routesReady) {
        console.log('[useUrlState] Sync from URL complete, unblocking sync back to URL');
        hasSyncedFromUrlRef.current = true;
      }
    } catch (error) {
      console.error('[useUrlState] Error syncing state from URL:', error);
      hasSyncedFromUrlRef.current = true; // Unblock on error to avoid being stuck
    }
  }, [location.pathname, basePath, schools, routes, selectedSchoolId, setSelectedSchool, setSelectedRoutes, directionFilter, setDirectionFilter, selectedStop, selectStop, clearSelectedStop, activeTab, setActiveTab, setMapIntent]);

  // Update URL when state changes
  useEffect(() => {
    // Check if route selection changed (user toggled routes)
    const currentSelectedRouteIds = routes.filter(r => r.isSelected).map(r => r.id).sort();
    const previousSelectedRouteIds = previousSelectedRouteIdsRef.current;
    const routeSelectionChanged = JSON.stringify(currentSelectedRouteIds) !== JSON.stringify(previousSelectedRouteIds);
    
    // Check if stop selection changed
    const currentSelectedStopId = selectedStop?.stop.id;
    const previousSelectedStopId = previousSelectedStopIdRef.current;
    const stopChanged = currentSelectedStopId !== previousSelectedStopId;

    // Clear DOUBLE_FIT mapIntent when route selection changes (user is browsing, not in "Find My Stop" mode)
    // This prevents 'my-stop' focus from persisting when routes are toggled
    // Only do this if we're not in the middle of syncing from URL (to avoid clearing during URL sync)
    // CRITICAL: We only clear if routes changed but the STOP stayed the same (manual toggle).
    // If the stop also changed, it's likely a "Find My Stop" operation.
    if (routeSelectionChanged && !stopChanged && hasSyncedFromUrlRef.current && !isNavigatingRef.current) {
      const currentMapIntent = useStore.getState().mapIntent;
      if (currentMapIntent?.type === 'DOUBLE_FIT') {
        console.log('[useUrlState] Clearing DOUBLE_FIT mapIntent: route selection changed (manual toggle)');
        setMapIntent(null);
      }
    }
    
    // Update the previous refs after checking
    previousSelectedRouteIdsRef.current = currentSelectedRouteIds;
    previousSelectedStopIdRef.current = currentSelectedStopId;
    
    // Also clear if no selected stop (regardless of route selection change)
    const currentMapIntent = useStore.getState().mapIntent;
    if (currentMapIntent?.type === 'DOUBLE_FIT' && !selectedStop && hasSyncedFromUrlRef.current) {
      console.log('[useUrlState] Clearing DOUBLE_FIT mapIntent: no selected stop');
      setMapIntent(null);
    }
    
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
  }, [updateUrlFromState, cancelPendingUrlUpdate, selectedSchoolId, activeTab, routes, selectedStop, directionFilter, basePath, mapIntent, setMapIntent]);

  const markRouteToggle = useCallback(() => {
    // This is called when a route is toggled in the UI.
    updateUrlFromState();
  }, [updateUrlFromState]);

  return {
    cancelPendingUrlUpdate,
    markRouteToggle,
  };
}
