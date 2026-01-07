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
  const previousActiveTabRef = useRef<'schools' | 'routes' | 'neighborhoods' | undefined>(undefined);
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
    if (!hasSyncedFromUrlRef.current) {
      console.log('[useUrlState] Skipping URL update: initial sync from URL in progress');
      return;
    }

    cancelPendingUrlUpdate();

    const performUpdate = () => {
      const state = useStore.getState();
      const currentRoutes = state.routes;
      const currentSelectedStop = state.selectedStop;
      const currentDirectionFilter = state.directionFilter;
      const currentSelectedSchoolId = state.selectedSchoolId;
      const currentActiveTab = state.activeTab;
      const currentMapIntent = state.mapIntent;

      // CRITICAL: Don't perform URL updates while routes are still loading for a school.
      // This prevents the URL from being "wiped" (losing route/stop segments) 
      // before the freshly loaded routes have had a chance to sync with the URL.
      if (currentSelectedSchoolId && currentRoutes.length === 0 && state.isLoading) {
        console.log('[useUrlState] Skipping URL update: routes loading for school', currentSelectedSchoolId);
        return;
      }

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

          if (selectedRouteNames.length > 0) {
            urlState.routeNames = selectedRouteNames;
          }

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
          } else {
            // CRITICAL: If my-stop focus is set but selectedStop isn't available yet, preserve stopId from URL
            // This prevents the URL from being cleared during the race condition on first load
            const existingUrlState = parseUrlPath(location.pathname, basePath);
            if (existingUrlState.focus === 'my-stop' && existingUrlState.stopId && existingUrlState.schoolId === urlState.schoolId) {
              urlState.stopId = existingUrlState.stopId;
            }
          }
        }
      }

      if (currentMapIntent) {
        if (currentMapIntent.type === 'ZOOM_SCHOOL' && currentMapIntent.data?.showInfo) {
          urlState.focus = 'school-info';
        } else if (currentMapIntent.type === 'FIT_HOME') {
          urlState.focus = 'home';
        } else if (currentMapIntent.type === 'DOUBLE_FIT') {
          // CRITICAL: For my-stop focus, preserve it even if selectedStop isn't available yet
          // This prevents the URL from being cleared during the race condition on first load
          if (currentSelectedStop) {
            urlState.focus = 'my-stop';
          } else {
            // If DOUBLE_FIT is set but selectedStop isn't available yet, preserve focus from URL
            const existingUrlState = parseUrlPath(location.pathname, basePath);
            if (existingUrlState.focus === 'my-stop' && existingUrlState.schoolId === urlState.schoolId) {
              urlState.focus = 'my-stop';
            }
          }
        } else if (currentMapIntent.type === 'MANUAL' && currentMapIntent.data) {
          urlState.focus = `${currentMapIntent.data.lat},${currentMapIntent.data.lng},${currentMapIntent.data.zoom}`;
        }
      } else {
        // If no active intent, check if we should carry over focus from the current URL
        // but only if it's still relevant to the current school/tab.
        const existingUrlState = parseUrlPath(location.pathname, basePath);
        if (existingUrlState.focus && existingUrlState.schoolId === urlState.schoolId) {
          // CRITICAL: Don't carry over school-info focus when switching to routes tab
          // school-info is only relevant for the schools tab
          if (existingUrlState.focus === 'school-info' && urlState.show === 'routes') {
            // Don't carry over school-info to routes tab - let FIT_ROUTES intent be set instead
          } else {
            // Carry over other focus segments (home, my-stop, or coordinates)
            // to maintain the user's current view perspective across minor state changes.
            urlState.focus = existingUrlState.focus;
          }
        }
      }

      const newPath = buildUrlPath(basePath, urlState);
      const currentPath = location.pathname.replace(/\/$/, '') || '/';
      const normalizedNewPath = newPath.replace(/\/$/, '') || '/';

      if (normalizedNewPath !== currentPath) {
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

    let intent: MapIntent | null = null;
    
    if (urlState.focus === 'school-info') {
      intent = { type: 'ZOOM_SCHOOL', data: { schoolId: urlState.schoolId, showInfo: true } };
    } else if (urlState.focus === 'home') {
      intent = { type: 'FIT_HOME', data: { showInfo: true } };
    } else if (urlState.focus === 'my-stop') {
      intent = { type: 'DOUBLE_FIT' };
    } else if (urlState.stopId) {
      intent = { type: 'ZOOM_STOP', data: { stopId: urlState.stopId, showInfo: true } };
    } else if (urlState.focus && /^-?\d+\.?\d*,-?\d+\.?\d*,\d+$/.test(urlState.focus || '')) {
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

    if (isNavigatingRef.current) {
      console.log('[useUrlState] Ignoring URL change: just navigated from state');
      isNavigatingRef.current = false;
      // Only mark synced immediately if this navigation did NOT include deep-link routing info.
      const hasDeepLinkRoutes = !!(urlState.routeNames && urlState.routeNames.length);
      const hasStopOrFocus = !!urlState.stopId || ['my-stop', 'home', 'school-info'].includes(urlState.focus || '');
      if (!hasDeepLinkRoutes && !hasStopOrFocus) {
        hasSyncedFromUrlRef.current = true;
        return;
      }
      // For deep links, fall through so we can process and only mark synced when selections match.
    }

    const urlChanged = JSON.stringify(urlState) !== JSON.stringify(previousUrlState);
    const directionChanged = urlState.direction !== previousUrlState.direction;
    
    // REQUIREMENT: Keep syncing until the store state matches the URL targets (selectionMatch && stopMatch)
    // or until we hit a terminal state (no routes available).
    // Returning early here if hasSyncedFromUrlRef is false would prevent deep-link stop/route selection.
    if (!urlChanged && !isFirstRoutesLoad && hasSyncedFromUrlRef.current) {
      return;
    }

    if (urlChanged || isFirstRoutesLoad) {
      console.log('[useUrlState] Starting sync from URL, blocking sync back to URL. URL:', location.pathname);
      hasSyncedFromUrlRef.current = false;
    }

    console.log('[useUrlState] Syncing state from URL:', location.pathname, urlState, { 
      isFirstRoutesLoad, 
      urlChanged,
      currentStoreSchoolId: selectedSchoolId,
      currentStoreTab: activeTab
    });

    try {
      // CRITICAL: Only sync tab from URL if it wasn't just changed by user
      // Check if tab changed in store (user-initiated) before syncing from URL
      const tabJustChanged = previousActiveTabRef.current !== undefined && previousActiveTabRef.current !== activeTab;
      if (urlState.show && urlState.show !== activeTab && !tabJustChanged) {
        setActiveTab(urlState.show);
      }
      // Update ref after checking
      previousActiveTabRef.current = activeTab;

      if (urlState.schoolId) {
        const school = schools.find(s => s.id.toLowerCase() === urlState.schoolId?.toLowerCase());
        
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

      if (urlState.direction) {
        const newDir = urlState.direction === 'morning' ? 'Morning' : 
                      urlState.direction === 'afternoon' ? 'Afternoon' : 'Both';
        if (directionFilter !== newDir) {
          setDirectionFilter(newDir);
        }
      }

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

      const hasRoutesInUrl = !!urlState.routeNames && urlState.routeNames.length > 0;
      const routesReady = routes.length > 0;

      if (hasRoutesInUrl && routesReady) {
        const effectiveDirection = urlState.direction || directionFilter.toLowerCase();
        
        // 1. Calculate target route IDs from URL (current direction only)
        const targetRouteIdsForDirection = routes
          .filter(r => {
            const nameMatches = urlState.routeNames!.includes(r.name);
            const directionMatches = effectiveDirection === 'both' || !r.direction || r.direction?.toLowerCase() === effectiveDirection;
            return nameMatches && directionMatches;
          })
          .map(r => r.id)
          .sort();
        
        // 2. Calculate current selected route IDs (current direction only)
        const currentSelectedRouteIdsForDirection = routes
          .filter(r => r.isSelected && (effectiveDirection === 'both' || !r.direction || r.direction?.toLowerCase() === effectiveDirection))
          .map(r => r.id)
          .sort();
          
        const selectionMatch = JSON.stringify(targetRouteIdsForDirection) === JSON.stringify(currentSelectedRouteIdsForDirection);

        let stopMatch = true;
        if (urlState.stopId && selectedStop) {
          const isUpcoming = urlState.stopId.endsWith('-upcoming');
          const cleanStopIdFromUrl = isUpcoming ? urlState.stopId.replace('-upcoming', '') : urlState.stopId;
          const lastDashIndex = cleanStopIdFromUrl.lastIndexOf('-');
          let stopNumFromUrl = '';
          if (lastDashIndex !== -1) {
            stopNumFromUrl = cleanStopIdFromUrl.substring(lastDashIndex + 1);
          }
          const stopIdToFind = stopNumFromUrl.startsWith('stop-') ? stopNumFromUrl : `stop-${stopNumFromUrl}`;
          stopMatch = selectedStop.stop.id === stopIdToFind;
        } else if (urlState.stopId && !selectedStop) {
          stopMatch = false;
        }

        if (selectionMatch && stopMatch) {
          // CRITICAL: If URL has my-stop focus, wait until selectedStop is actually set
          // before marking sync complete, otherwise updateUrlFromState will clear the URL
          if (urlState.focus === 'my-stop' && !selectedStop) {
            console.log('[useUrlState] Deep link targets satisfied but waiting for selectedStop (my-stop focus)');
            // Don't mark sync complete yet
          } else {
            console.log('[useUrlState] Deep link targets satisfied (Selection:', selectionMatch, 'Stop:', stopMatch, '), marking sync complete');
            hasSyncedFromUrlRef.current = true;
          }
        } else {
          console.log('[useUrlState] Deep link targets NOT satisfied yet (Selection:', selectionMatch, 'Stop:', stopMatch, '). URL expects stopId:', urlState.stopId, 'but store selectedStop is:', selectedStop?.stop.id);
        }
      } else if (!hasRoutesInUrl && routesReady) {
        // CRITICAL: If URL has my-stop focus, wait until selectedStop is set before marking sync complete
        // Otherwise updateUrlFromState will run and clear the stopId/focus from URL
        if (urlState.focus === 'my-stop' && !selectedStop) {
          console.log('[useUrlState] Routes ready but waiting for selectedStop to be set from URL (my-stop focus)');
          // Don't mark sync complete yet - wait for selectedStop
        } else {
          console.log('[useUrlState] Sync from URL complete (no route targets), unblocking sync back to URL');
          hasSyncedFromUrlRef.current = true;
        }
      } else if (urlState.schoolId && !routesReady && !useStore.getState().isLoading) {
        // CRITICAL: Don't mark sync complete if URL has routeNames that need to be synced
        // Wait for routes to load and be selected before allowing URL updates
        if (urlState.routeNames && urlState.routeNames.length > 0) {
          console.log('[useUrlState] URL has routeNames but routes not ready yet, waiting for routes to load');
          // Don't mark sync complete yet - wait for routes to load and be selected
        } else {
          // If we have a school ID but no routes and NOT loading, maybe there are no routes?
          console.log('[useUrlState] No routes available for school, marking sync complete');
          hasSyncedFromUrlRef.current = true;
        }
      } else if (routesReady && !hasSyncedFromUrlRef.current) {
        // Fallback: if routes are ready but we've been trying to sync for a while and failed,
        // we might have an invalid stop ID in the URL. Unblock after a few attempts.
        // We'll use a local counter or just rely on the next state change to retry.
        console.log('[useUrlState] Routes ready but sync not satisfied. Still waiting for stopId:', urlState.stopId);
      }
    } catch (error) {
      console.error('[useUrlState] Error syncing state from URL:', error);
      hasSyncedFromUrlRef.current = true;
    }
  }, [location.pathname, basePath, schools, routes, selectedSchoolId, setSelectedSchool, setSelectedRoutes, directionFilter, setDirectionFilter, selectedStop, selectStop, clearSelectedStop, activeTab, setActiveTab, setMapIntent]);

  // Update URL when state changes
  useEffect(() => {
    const currentSelectedRouteIds = routes.filter(r => r.isSelected).map(r => r.id).sort();
    const previousSelectedRouteIds = previousSelectedRouteIdsRef.current;
    const routeSelectionChanged = JSON.stringify(currentSelectedRouteIds) !== JSON.stringify(previousSelectedRouteIds);
    
    const currentSelectedStopId = selectedStop?.stop.id;
    const previousSelectedStopId = previousSelectedStopIdRef.current;
    const stopChanged = currentSelectedStopId !== previousSelectedStopId;

    const currentUrlState = parseUrlPath(window.location.pathname, basePath);
    
    // CRITICAL: If we were waiting for selectedStop and it's now available, mark sync complete
    // This allows updateUrlFromState to run now that we have all the data
    // Check this BEFORE the hasSyncedFromUrlRef check so we can unblock sync
    if (currentUrlState.focus === 'my-stop' && selectedStop && !hasSyncedFromUrlRef.current) {
      console.log('[useUrlState] selectedStop now available for my-stop focus, marking sync complete');
      hasSyncedFromUrlRef.current = true;
    }

    if (!hasSyncedFromUrlRef.current) {
      console.log('[useUrlState] Skipping URL update check: initial sync from URL still in progress');
      previousSelectedRouteIdsRef.current = currentSelectedRouteIds;
      previousSelectedStopIdRef.current = currentSelectedStopId;
      return;
    }

    // CRITICAL: Also skip if URL has my-stop focus but selectedStop isn't set yet
    // This prevents updateUrlFromState from clearing the URL during the race condition
    if (currentUrlState.focus === 'my-stop' && !selectedStop) {
      console.log('[useUrlState] Skipping URL update: waiting for selectedStop to be set (my-stop focus)');
      previousSelectedRouteIdsRef.current = currentSelectedRouteIds;
      previousSelectedStopIdRef.current = currentSelectedStopId;
      return;
    }

    // CRITICAL: Skip if URL has routeNames but routes haven't been selected yet
    // This prevents the URL from being cleared (bouncing) when routes are still loading
    if (currentUrlState.routeNames && currentUrlState.routeNames.length > 0 && currentSelectedRouteIds.length === 0 && routes.length > 0) {
      // Routes are loaded but not selected yet - wait for URL sync to select them
      console.log('[useUrlState] Skipping URL update: waiting for routes to be selected from URL');
      previousSelectedRouteIdsRef.current = currentSelectedRouteIds;
      previousSelectedStopIdRef.current = currentSelectedStopId;
      return;
    }

    // Restore DOUBLE_FIT cleanup: if routes change (manual toggle) and stop didn't change, clear DOUBLE_FIT
    if (routeSelectionChanged && !stopChanged && !isNavigatingRef.current) {
      const currentMapIntent = useStore.getState().mapIntent;
      if (currentMapIntent?.type === 'DOUBLE_FIT') {
        console.log('[useUrlState] Clearing DOUBLE_FIT mapIntent: route selection changed (manual toggle)');
        setMapIntent(null);
      }
    }

    // Also clear DOUBLE_FIT if no selected stop
    const currentMapIntent = useStore.getState().mapIntent;
    if (currentMapIntent?.type === 'DOUBLE_FIT' && !selectedStop) {
      console.log('[useUrlState] Clearing DOUBLE_FIT mapIntent: no selected stop');
      setMapIntent(null);
    }
    
    previousSelectedRouteIdsRef.current = currentSelectedRouteIds;
    previousSelectedStopIdRef.current = currentSelectedStopId;
    
    // currentUrlState already declared above at line 475
    const schoolChanged = selectedSchoolId?.toLowerCase() !== currentUrlState.schoolId?.toLowerCase();
    const tabChanged = activeTab !== currentUrlState.show;
    
    if (schoolChanged || tabChanged) {
      updateUrlFromState(true);
    } else {
      updateUrlFromState();
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
