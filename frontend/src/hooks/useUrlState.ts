import { useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { School, Route, MapIntent } from '../types';
import { parseUrlPath, buildUrlPath, UrlState } from '../services/urlState';
import { useStore } from '../store/useStore';
import { findClosestStopInDirection } from '../utils/findClosestStopInDirection';

interface UseUrlStateOptions {
  basePath?: string;
}

interface UseUrlStateReturn {
  // Current selection derived from URL
  schoolId: string | null;
  activeTab: 'schools' | 'routes' | 'neighborhoods';
  directionFilter: 'Morning' | 'Afternoon' | 'Both';
  selectedRouteNames: string[];
  selectedStopId: string | null;
  focus: string | null;
  
  // Actions that update the URL
  setSelectedSchool: (schoolId: string | null) => void;
  setActiveTab: (tab: 'schools' | 'routes' | 'neighborhoods') => void;
  setDirectionFilter: (direction: 'Morning' | 'Afternoon' | 'Both') => void;
  toggleRouteSelection: (routeName: string) => void;
  setSelectedRoutes: (routeNames: string[]) => void;
  viewSchoolRoutes: (schoolId: string) => void;
  selectStop: (routeName: string, stopId: string, options?: { 
    doubleFit?: boolean, 
    direction?: 'Morning' | 'Afternoon' | 'Both',
    show?: 'schools' | 'routes' | 'neighborhoods',
    soleRoute?: boolean
  }) => void;
  clearSelectedStop: () => void;
  setFocus: (focus: string | null) => void;
}

/**
 * Hook to use URL as the single source of truth for application selection state
 */
export function useUrlState({
  basePath = '',
}: UseUrlStateOptions = {}): UseUrlStateReturn {
  const navigate = useNavigate();
  const location = useLocation();
  const { 
    setMapIntent, 
    routes, 
    homeAddress,
    lookupAddress,
    lastRouteNames, setLastRouteNames, 
    lastDirection, setLastDirection,
    lastStopId, setLastStopId,
    lastFocus, setLastFocus
  } = useStore();
  const lastProcessedStateRef = useRef<string>('');

  // 1. Derive current state from URL
  const urlState = useMemo(() => parseUrlPath(location.pathname, basePath), [location.pathname, basePath]);

  const schoolId = urlState.schoolId || null;
  const activeTab = urlState.show || 'schools';
  const directionFilter = urlState.direction === 'morning' ? 'Morning' : 
                         urlState.direction === 'afternoon' ? 'Afternoon' : 'Both';
  const selectedRouteNames = urlState.routeNames || [];
  const selectedStopId = urlState.stopId || null;
  const focus = urlState.focus || null;

  // Sync current selection to "last known" for tab switching preservation
  useEffect(() => {
    if (activeTab === 'routes' && schoolId) {
      if (urlState.routeNames && urlState.routeNames.length > 0) {
        setLastRouteNames(urlState.routeNames);
      }
      if (urlState.direction) {
        setLastDirection(urlState.direction);
      }
      if (urlState.stopId) {
        setLastStopId(urlState.stopId);
      } else {
        // If no stop in URL but we are on routes tab, clear cached stop
        setLastStopId(null);
      }
      if (urlState.focus && urlState.focus !== 'school-info') {
        setLastFocus(urlState.focus);
      } else {
        setLastFocus(null);
      }
    }
  }, [activeTab, schoolId, urlState.routeNames, urlState.direction, urlState.stopId, urlState.focus, setLastRouteNames, setLastDirection, setLastStopId, setLastFocus]);

  // 2. Helper to update URL
  const updateUrl = useCallback((updates: Partial<UrlState>, replace = false) => {
    const newState = { ...urlState, ...updates };
    const newPath = buildUrlPath(basePath, newState);
    const currentPath = location.pathname.replace(/\/$/, '') || '/';
    const normalizedNewPath = newPath.replace(/\/$/, '') || '/';

    if (normalizedNewPath !== currentPath) {
      console.log('[useUrlState] Navigating to:', newPath);
      navigate(newPath, { replace });
    }
  }, [urlState, basePath, navigate, location.pathname]);

  // 3. Actions
  const setSelectedSchool = useCallback((id: string | null) => {
    // If selecting a different school, clear last known route/stop state
    // This prevents "last known" selection from one school leaking to another
    if (id !== schoolId) {
      setLastRouteNames(null);
      setLastDirection(null);
      setLastStopId(null);
      setLastFocus(null);
    }

    if (!id) {
      updateUrl({ schoolId: undefined, routeNames: undefined, stopId: undefined, focus: undefined, show: 'schools' });
    } else {
      // Scenario 1: click school -> URL changes to /SCHOOL/school-info, school dialog shown
      if (activeTab === 'schools') {
        updateUrl({ schoolId: id, focus: 'school-info', routeNames: undefined, stopId: undefined });
      } else {
        // If on routes tab, change school but clear stop/focus
        updateUrl({ schoolId: id, routeNames: undefined, stopId: undefined, focus: undefined });
      }
    }
  }, [updateUrl, activeTab, schoolId, setLastRouteNames, setLastDirection, setLastStopId, setLastFocus]);

  const setActiveTab = useCallback((tab: 'schools' | 'routes' | 'neighborhoods') => {
    const updates: Partial<UrlState> = { show: tab };
    
    if (tab === 'schools') {
      // Scenario 7: tab back to schools -> should be zoomed in on school and showing dialog
      if (schoolId) {
        updates.schoolId = schoolId;
        updates.focus = 'school-info';
      } else {
        updates.focus = undefined;
      }
      updates.stopId = undefined;
      updates.routeNames = undefined;
    } else if (tab === 'routes') {
      // Scenario 7 & 10: click back to routes tab -> should still be showing previously selected route/stop
      if (schoolId) {
        updates.schoolId = schoolId;
        
        // Scenario 3: If switching to routes for first time (no lastRouteNames), select all routes for direction
        const currentRoutes = routes.filter(r => 
          !lastDirection || lastDirection === 'both' || r.direction?.toLowerCase() === lastDirection
        );
        
        // Deduplicate route names (e.g. avoid "100,100" if AM and PM both exist)
        const defaultNames = Array.from(new Set(currentRoutes.map(r => r.name)));
        
        updates.routeNames = (lastRouteNames && lastRouteNames.length > 0) 
          ? lastRouteNames 
          : (defaultNames.length > 0 ? defaultNames : undefined);
          
        updates.direction = (lastDirection as any) || 'morning';
        
        if (lastStopId) {
          updates.stopId = lastStopId;
          updates.focus = (lastFocus as any) || 'my-stop';
        } else {
          updates.focus = undefined;
        }
      }
    }
    
    updateUrl(updates);
  }, [updateUrl, schoolId, lastRouteNames, lastDirection, lastStopId, lastFocus, routes]);

  const setDirectionFilter = useCallback((direction: 'Morning' | 'Afternoon' | 'Both') => {
    const directionLower = direction.toLowerCase();
    
    // Rule: direction changes MUST attempt to carry over route/stop selection by name
    let updates: Partial<UrlState> = { 
      direction: directionLower as any,
      focus: focus === 'my-stop' ? 'my-stop' : (focus || undefined)
    };

    // Scenario 5: carry over stop selection by finding closest in new direction
    if (selectedStopId && direction !== 'Both') {
      const currentStop = routes.flatMap(r => 
        r.stops.map((s, i) => ({ route: r, stop: s, stopNumber: i + 1 }))
      ).find(item => {
        const stopId = `${item.route.name}-${item.stop.id.replace('stop-', '')}`;
        return selectedStopId.startsWith(stopId);
      });

      if (currentStop) {
        const result = findClosestStopInDirection(currentStop, direction as any, routes);
        if (result) {
          updates.stopId = `${result.route.name}-${result.stop.id.replace('stop-', '')}`;
          if (result.route.name.includes('-upcoming')) updates.stopId += '-upcoming';
        } else {
          // If no equivalent stop found, clear stopId
          updates.stopId = undefined;
        }
      }
    } else {
      // Scenario 5: deselect stop if switching to 'Both' or no stop selected
      updates.stopId = undefined;
    }
    
    updateUrl(updates);
  }, [updateUrl, focus, routes, selectedStopId]);

  const toggleRouteSelection = useCallback((routeName: string) => {
    let newRouteNames = [...selectedRouteNames];
    if (newRouteNames.includes(routeName)) {
      newRouteNames = newRouteNames.filter(name => name !== routeName);
    } else {
      newRouteNames.push(routeName);
    }
    
    // Scenario 5 & 6: should zoom to fit routes that are toggled on
    updateUrl({ 
      routeNames: newRouteNames.length > 0 ? newRouteNames : undefined,
      stopId: undefined,
      focus: focus === 'my-stop' ? undefined : (focus || undefined)
    });
  }, [selectedRouteNames, updateUrl, focus]);

  const setSelectedRoutes = useCallback((routeNames: string[]) => {
    updateUrl({ 
      routeNames: routeNames.length > 0 ? routeNames : undefined,
      stopId: undefined,
      focus: focus === 'my-stop' ? undefined : (focus || undefined)
    });
  }, [updateUrl, focus]);

  const viewSchoolRoutes = useCallback((id: string) => {
    // Determine the direction - use current, or last known, or default to morning
    const direction = (id === schoolId ? (urlState.direction || (lastDirection as any)) : null) || 'morning';
    
    // Find routes for this school and direction to pre-populate and avoid duplicates
    const schoolRoutes = routes.filter(r => 
      r.direction?.toLowerCase() === direction.toLowerCase() || direction.toLowerCase() === 'both'
    );
    const routeNames = schoolRoutes.length > 0 
      ? Array.from(new Set(schoolRoutes.map(r => r.name)))
      : undefined;

    updateUrl({
      schoolId: id,
      show: 'routes',
      focus: undefined,
      direction: direction as any,
      routeNames,
      stopId: undefined
    });
  }, [updateUrl, schoolId, urlState.direction, lastDirection, routes]);

  const selectStop = useCallback((
    routeName: string, 
    stopId: string, 
    options?: { 
      doubleFit?: boolean, 
      direction?: 'Morning' | 'Afternoon' | 'Both',
      show?: 'schools' | 'routes' | 'neighborhoods',
      soleRoute?: boolean
    }
  ) => {
    // When selecting a stop, determine which routes to show
    let newRouteNames: string[];
    
    if (options?.soleRoute) {
      // If soleRoute is requested, only show the route containing this stop
      newRouteNames = [routeName];
    } else {
      // Otherwise, ensure its route is selected but keep existing ones
      newRouteNames = [...selectedRouteNames];
      if (!newRouteNames.includes(routeName)) {
        newRouteNames.push(routeName);
      }
    }
    
    // Normalize stop ID format (e.g. "148-1")
    const stopMatch = stopId.match(/stop-(\d+)/);
    const stopNumber = stopMatch ? stopMatch[1] : stopId;
    const finalStopId = routeName.endsWith('-upcoming') 
      ? `${routeName.replace('-upcoming', '')}-${stopNumber}-upcoming`
      : `${routeName}-${stopNumber}`;

    updateUrl({ 
      routeNames: newRouteNames,
      stopId: finalStopId,
      direction: (options?.direction?.toLowerCase() as any) || urlState.direction,
      show: options?.show || urlState.show,
      // Scenario 9 & 12: URL should be .../ROUTE-STOP/my-stop for double fit
      focus: options?.doubleFit ? 'my-stop' : undefined
    });
  }, [selectedRouteNames, updateUrl, urlState]);

  const clearSelectedStop = useCallback(() => {
    // Scenario 2: Zoom out to show all current content when closing dialog
    updateUrl({ 
      stopId: undefined, 
      focus: undefined 
    });
  }, [updateUrl]);

  const setFocus = useCallback((newFocus: string | null) => {
    updateUrl({ focus: newFocus || undefined });
  }, [updateUrl]);

  // Populate default routes if on routes tab with none specified
  useEffect(() => {
    if (activeTab === 'routes' && schoolId && routes.length > 0 && selectedRouteNames.length === 0) {
      console.log('[useUrlState] Populating default routes...');
      const directionLower = directionFilter.toLowerCase();
      
      // Deduplicate route names (e.g. avoid "100,100" if AM and PM both exist)
      const defaultNames = Array.from(new Set(
        routes
          .filter(r => directionLower === 'both' || r.direction?.toLowerCase() === directionLower)
          .map(r => r.name)
      ));
      
      if (defaultNames.length > 0) {
        updateUrl({ routeNames: defaultNames }, true); // Use replace to not pollute history
      }
    }
  }, [activeTab, schoolId, routes, selectedRouteNames.length, directionFilter, updateUrl]);

  // 4. Side effect: Update MapIntent based on URL
  useEffect(() => {
    const activeHome = homeAddress || lookupAddress;
    
    // Create a key representing the current selection state that affects map intent
    const stateKey = JSON.stringify({
      schoolId,
      activeTab,
      directionFilter,
      selectedRouteNames,
      selectedStopId,
      focus,
      hasRoutes: routes.length > 0,
      homeAddr: activeHome?.address,
      hasHomeCoords: !!activeHome?.coordinates
    });

    // Skip if this exact selection state has already triggered an intent
    if (stateKey === lastProcessedStateRef.current) return;

    let intent: MapIntent | null = null;
    
    // Priority 1: Explicit Focus (Stop, School Info, Home)
    if (focus === 'school-info') {
      // Scenario 1: /SCHOOL/school-info -> zoom into school pin and show dialog
      intent = { type: 'ZOOM_SCHOOL', data: { schoolId, showInfo: true } };
    } else if (focus === 'home') {
      // Zoom to home and show dialog
      intent = { type: 'FIT_HOME', data: { showInfo: true } };
    } else if (focus === 'my-stop') {
      // Scenario 9 & 12: /my-stop -> double fit zoom to show stop and home
      if (activeHome && activeHome.coordinates && selectedStopId) {
        intent = { type: 'DOUBLE_FIT' };
      } else if (selectedStopId) {
        intent = { type: 'ZOOM_STOP', data: { stopId: selectedStopId, showInfo: true } };
      }
    } else if (selectedStopId) {
      // Scenario 4 & 5: /STOP_ID in URL -> zoom to fit stop pin and show dialog
      intent = { type: 'ZOOM_STOP', data: { stopId: selectedStopId, showInfo: true } };
    } else if (focus && /^-?\d+\.?\d*,-?\d+\.?\d*,\d+$/.test(focus)) {
      const parts = focus.split(',');
      if (parts.length === 3) {
        const [lat, lng, zoom] = parts.map(Number);
        if (!isNaN(lat) && !isNaN(lng) && !isNaN(zoom)) {
          intent = { type: 'MANUAL', data: { lat, lng, zoom } };
        }
      }
    } 
    // Priority 2: Tab-based selection state (No specific pin focused)
    else {
      if (activeTab === 'routes' && schoolId) {
        // Scenario 3, 5, 6, 7: Zoom to show all routes in the URL
        if (selectedRouteNames.length > 0) {
          intent = { type: 'FIT_ROUTES' };
        } else if (routes.length > 0) {
          intent = { type: 'ZOOM_SCHOOL', data: { schoolId } };
        }
      } else if (activeTab === 'schools') {
        if (schoolId) {
          // Rule 3: if a school is in the URL on /schools/ that means it's selected.
          // that means it should be zoomed into it.
          intent = { type: 'ZOOM_SCHOOL', data: { schoolId, showInfo: true } };
        } else {
          // Scenario 2 & 8: No school in URL -> show all schools
          intent = { type: 'FIT_SCHOOLS' };
        }
      }
    }

    // Only dispatch if we actually derived an intent and it's different from current
    if (intent) {
      const currentIntent = useStore.getState().mapIntent;
      // We check type and basic data to avoid redundant fits during minor state changes
      const isSameIntent = currentIntent && 
        currentIntent.type === intent.type && 
        JSON.stringify(currentIntent.data) === JSON.stringify(intent.data);

      if (!isSameIntent) {
        console.log('[useUrlState] Derived map intent from URL:', intent.type, intent.data);
        setMapIntent(intent);
        lastProcessedStateRef.current = stateKey;
      }
    }
  }, [schoolId, activeTab, directionFilter, selectedRouteNames, selectedStopId, focus, setMapIntent, routes.length, 
      homeAddress, lookupAddress]);

  return {
    schoolId,
    activeTab,
    directionFilter,
    selectedRouteNames,
    selectedStopId,
    focus,
    setSelectedSchool,
    setActiveTab,
    setDirectionFilter,
    toggleRouteSelection,
    setSelectedRoutes,
    viewSchoolRoutes,
    selectStop,
    clearSelectedStop,
    setFocus
  };
}
