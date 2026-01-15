import React, { useEffect, useRef, useState, useMemo } from 'react';
import { MapContainer, Polyline, Marker, Popup, ZoomControl, GeoJSON } from 'react-leaflet';
import L from 'leaflet';
import { useNavigate, useLocation } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { fetchRouteForStops } from '../services/routing';
import { School, MapIntent } from '../types';
import { formatStreetName, extractStreetNames, expandAddressForGeocoding } from '../utils/formatAddress';
import { createHomeIcon, createDefaultMarkerIcon } from '../utils/fontAwesomeIcons';
import { createSchoolIcon, createNumberedIcon } from '../utils/markerIcons';
import { getSchoolTypes, getSchoolColor } from '../utils/schoolUtils';
import { calculateStopNumber, getMapStops } from '../utils/routeUtils';
import { geocodeAddress } from '../services/api';
import { toLeafletPosition, validateLngLat, formatCoordinates } from '../utils/coordinates';
import { DarkModeTileLayer } from './DarkModeTileLayer';
import { useIsMobile } from '../hooks/useMediaQuery';
import { analyticsService } from '../services/analytics';
import { MapInfoPanel } from './MapInfoPanel';
import { StopInfoTooltip } from './StopInfoTooltip';
import { SchoolInfoTooltip } from './SchoolInfoTooltip';
import { HomeInfoTooltip } from './HomeInfoTooltip';
import { NoRoutesModal } from './NoRoutesModal';
import { parseUrlPath, buildUrlPath } from '../services/urlState';
import { useUrlState } from '../hooks/useUrlState';
import 'leaflet/dist/leaflet.css';

const homeIcon = createHomeIcon();
const defaultMarkerIcon = createDefaultMarkerIcon();

interface RouteGeometry {
  [routeId: string]: [number, number][] | null; // null means still loading
}

interface MapViewProps {
  viewMode: 'schools' | 'routes';
  editingMode?: boolean;
  enableStreetHighlighting?: boolean;
  enableStreetPins?: boolean; // Enable the drop pins feature (admin only)
  onSelectSchool?: (schoolId: string | null) => void;
  schools?: School[]; // Optional: provide filtered schools for the map
}

interface UndoStep {
  routeId: string;
  stopId: string;
  coordinates: [number, number];
}

interface HighlightedStreet {
  name: string;
  geometry: [number, number][]; // [lat, lng][]
  bounds: {
    north: number;
    south: number;
    east: number;
    west: number;
  };
}

interface StreetMarker {
  streetName: string;
  coordinates: [number, number]; // [lng, lat]
}

export function MapView({
  viewMode,
  editingMode = false,
  enableStreetHighlighting = false,
  enableStreetPins = false,
  onSelectSchool,
  schools: schoolsProp
}: MapViewProps) {
  const {
    routes,
    schools: schoolsFromStore,
    homeAddress,
    lookupAddress,
    updateStopCoordinates,
    isLoading,
    mapIntent,
    setMapIntent,
    boundaries,
    showElementaryBoundaries,
    showMiddleBoundaries,
    showHighBoundaries,
    toggleBoundaryType,
    toggleAllBoundaries,
    assignedSchools,
    isFindMyStopVisible,
  } = useStore();

  const navigate = useNavigate();
  const location = useLocation();
  const schools = schoolsProp || schoolsFromStore;
  const basePath = location.pathname.startsWith('/admin') ? '/admin' : '';
  const isMobile = useIsMobile();
  const [map, setMap] = useState<L.Map | null>(null);
  const [routeGeometries, setRouteGeometries] = useState<RouteGeometry>({});
  const [undoHistory, setUndoHistory] = useState<UndoStep[]>([]);
  const routeRecalcTimeoutRef = useRef<{ [routeId: string]: ReturnType<typeof setTimeout> }>({});
  const [isMapReady, setIsMapReady] = useState(false);
  const isInitialLoadRef = useRef<boolean>(true);

  const [highlightedStreet, setHighlightedStreet] = useState<HighlightedStreet | null>(null);
  const [loadingStreet, setLoadingStreet] = useState<string | null>(null);
  const [streetError, setStreetError] = useState<string | null>(null);
  const [streetMarkers, setStreetMarkers] = useState<StreetMarker[]>([]);
  const [loadingStreetPins, setLoadingStreetPins] = useState<boolean>(false);
  const [isFlying, setIsFlying] = useState<boolean>(false);
  const isAutomatedMovingRef = useRef<boolean>(false);
  const focusRef = useRef<string | null>(null);

  // URL State is now the single source of truth for selection
  const {
    schoolId: selectedSchoolId,
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
  } = useUrlState({ basePath });

  // Update focusRef when focus changes
  useEffect(() => {
    focusRef.current = focus;
  }, [focus]);

  // Calculate selected routes based on URL selection
  const selectedRoutes = useMemo(() => {
    return routes.filter(route => {
      // Scenario 1: if no route names in URL and on routes tab, show all for direction
      const nameMatches = selectedRouteNames.length === 0 || selectedRouteNames.includes(route.name);
      const directionMatches = directionFilter === 'Both' || route.direction === directionFilter;
      return nameMatches && directionMatches;
    });
  }, [routes, selectedRouteNames, directionFilter]);

  // Calculate selected stop based on URL selection
  const selectedStop = useMemo(() => {
    if (!selectedStopId) return null;

    // Normalize selectedStopId for comparison
    const normalizedSelectedStopId = selectedStopId.replace('-upcoming', '');
    const segments = normalizedSelectedStopId.split('-');
    // Route name is everything except the last segment (the stop number)
    const selectedRouteName = segments.slice(0, -1).join('-');
    const selectedStopNumberId = segments[segments.length - 1];

    // Priority: Search routes matching the current direction filter first to avoid cross-route numbering issues
    const directionLower = directionFilter.toLowerCase();
    const sortedRoutes = [...routes].sort((a, b) => {
      const aMatches = directionLower === 'both' || a.direction?.toLowerCase() === directionLower;
      const bMatches = directionLower === 'both' || b.direction?.toLowerCase() === directionLower;
      if (aMatches && !bMatches) return -1;
      if (!aMatches && bMatches) return 1;
      return 0;
    });

    for (const route of sortedRoutes) {
      // Normalize route name for comparison
      const normalizedRouteName = route.name.replace('-upcoming', '');

      const stopIndex = route.stops.findIndex((s) => {
        const stopNumberId = s.id.replace('stop-', '');
        const routeStopId = `${normalizedRouteName}-${stopNumberId}`;
        const isExactMatch = s.id === selectedStopId || routeStopId === normalizedSelectedStopId;

        // If we have a route name and stop number from the URL, try matching those
        const isFuzzyMatch = selectedRouteName === normalizedRouteName && selectedStopNumberId === stopNumberId;

        return isExactMatch || isFuzzyMatch;
      });

      if (stopIndex !== -1) {
        const stop = route.stops[stopIndex];
        return {
          route,
          stop,
          stopNumber: calculateStopNumber(route, stop.id)
        };
      }
    }

    return null;
  }, [routes, selectedStopId, directionFilter]);

  const isSchoolInfoFocused = focus === 'school-info';
  const isHomeInfoFocused = focus === 'home';
  const isStopInfoFocused = !!selectedStop;

  // Memoize schools with coordinates
  const schoolsWithCoords = useMemo(() =>
    schools.filter((s: School) => s.coordinates && s.coordinates.length === 2),
    [schools]
  );

  // Track the set of schools for fitting
  const schoolsKey = useMemo(() =>
    schoolsWithCoords.map((s: School) => s.id).sort().join(','),
    [schoolsWithCoords]
  );

  // Track the set of selected routes for fitting
  const selectedRoutesKey = useMemo(() =>
    selectedRoutes.map(r => r.id).sort().join(','),
    [selectedRoutes]
  );

  // Return all boundaries for stable GeoJSON mounting (fading handled by style)
  const displayedBoundaries = useMemo(() => {
    return boundaries || null;
  }, [boundaries]);

  // Style function for boundaries based on school type
  const getBoundaryStyle = (feature: any) => {
    const rawType = feature?.properties?.zonetype;
    const type = rawType ? rawType.trim().toLowerCase() : '';
    let color = '#3388ff'; // Default blue

    // Determine color based on school type
    if (type === 'hs' || type.includes('high')) {
      color = '#FF9100'; // Orange for High School
    } else if (type === 'ms' || type.includes('middle')) {
      color = '#00B242'; // Green for Middle School
    } else if (type === 'k5' || type.includes('elementary') || type.includes('k8')) {
      color = '#0099FA'; // Blue for Elementary / K-8
    }

    // Determine visibility based on toggles
    const isHigh = type === 'hs' || type === 'high school' || type.includes('high');
    const isMiddle = type === 'ms' || type === 'middle school' || type.includes('middle');
    const isElem = type === 'k5' || type === 'elementary school' || type.includes('elementary') || type === 'k8' || type.includes('k8');

    let isVisible = (isHigh && showHighBoundaries) ||
      (isMiddle && showMiddleBoundaries) ||
      (isElem && showElementaryBoundaries);

    // Apply assigned schools filter if home address is set
    if (isVisible && homeAddress && assignedSchools) {
      const assignedNames = new Set<string>();
      Object.values(assignedSchools).forEach(school => {
        if (school && school.name) assignedNames.add(school.name.toLowerCase());
      });
      if (assignedNames.size > 0 && feature.properties?.name) {
        if (!assignedNames.has(feature.properties.name.toLowerCase())) {
          isVisible = false;
        }
      }
    }

    const opacity = isVisible ? 0.6 : 0;
    const fillOpacity = isVisible ? 0.1 : 0;

    return {
      color: color,
      weight: 2,
      opacity: opacity,
      fillColor: color,
      fillOpacity: fillOpacity,
      isBoundary: true as any // Custom flag to identify boundaries in layer iteration
    };
  };

  // Auto-fit when the set of schools rendered on the map changes in schools view.
  useEffect(() => {
    if (!map || !isMapReady) return;
    if (viewMode !== 'schools') return;
    if (schoolsWithCoords.length === 0) return;

    const coords: [number, number][] = schoolsWithCoords.map((s: School) => [s.coordinates![1], s.coordinates![0]] as [number, number]);
    const bounds = L.latLngBounds(coords);
    const duration = 0.4;
    executeFlyTo(() => {
      map.flyToBounds(bounds, {
        paddingTopLeft: [50, 50],
        paddingBottomRight: isMobile ? [50, MOBILE_PADDING_BOTTOM] : [50, 50],
        duration
      });
    }, duration);
  }, [map, isMapReady, viewMode, schoolsKey, schoolsWithCoords, isMobile]);

  // Mark map as ready and attach listeners
  useEffect(() => {
    if (!map || typeof map.on !== 'function') return;
    const checkReady = () => {
      if (map.getContainer()) {
        console.log('[MapView] Map container ready');
        setIsMapReady(true);
      }
    };

    // Attach map interaction listeners
    const onZoomEnd = () => {
      analyticsService.trackMapInteraction(`zoom_${map.getZoom()}`);

      // If user manually interacts, clear any transient focus like 'my-stop'
      if (!isAutomatedMovingRef.current && focusRef.current === 'my-stop') {
        console.log('[MapView] User zoomed manually, clearing focus');
        setFocus(null);
      }
    };

    const onMoveEnd = () => {
      const center = map.getCenter();
      analyticsService.trackAction('map_move', {
        lat: center.lat.toFixed(4),
        lng: center.lng.toFixed(4),
        zoom: map.getZoom()
      });

      // If user manually interacts, clear any transient focus like 'my-stop'
      if (!isAutomatedMovingRef.current && focusRef.current === 'my-stop') {
        console.log('[MapView] User moved manually, clearing focus');
        setFocus(null);
      }
    };

    const onClick = (e: L.LeafletMouseEvent) => {
      // Only track clicks that aren't on markers (which are handled by marker click handlers)
      if (e.originalEvent.target === map.getContainer() || (e.originalEvent.target as HTMLElement).classList.contains('leaflet-zoom-animated')) {
        analyticsService.trackAction('map_click', {
          lat: e.latlng.lat.toFixed(4),
          lng: e.latlng.lng.toFixed(4)
        });

        // Clicking empty space on map should also clear temporary focus
        if (!isAutomatedMovingRef.current && focusRef.current === 'my-stop') {
          setFocus(null);
        }
      }
    };

    map.on('zoomend', onZoomEnd);
    map.on('moveend', onMoveEnd);
    map.on('click', onClick);

    if (typeof map.whenReady === 'function') {
      map.whenReady(checkReady);
    }
    checkReady();

    return () => {
      if (typeof map.off === 'function') {
        map.off('zoomend', onZoomEnd);
        map.off('moveend', onMoveEnd);
        map.off('click', onClick);
      }
    };
  }, [map, setFocus, isFlying]);

  // Update polyline opacities when isFlying changes
  useEffect(() => {
    if (!map || !isMapReady) return;

    // Small delay to ensure DOM is ready for transitions
    const timeoutId = setTimeout(() => {
      map.eachLayer((layer) => {
        if (layer instanceof L.Polyline && layer.options.color && !(layer.options as any).isBoundary) {
          // This is a route polyline - apply opacity with transition
          const pathElement = layer.getElement() as HTMLElement | SVGElement | null;
          if (pathElement) {
            if (isFlying) {
              // Fade out - quick 0.2s transition
              pathElement.style.transition = 'opacity 0.2s ease-in-out, fill-opacity 0.2s ease-in-out';
              layer.setStyle({
                opacity: 0,
                fillOpacity: 0
              });
              pathElement.style.opacity = '0';
              pathElement.setAttribute('fill-opacity', '0');
            } else {
              // Fade in - shorter 0.5s transition
              pathElement.style.transition = 'opacity 0.5s ease-in-out, fill-opacity 0.5s ease-in-out';
              // Restore opacity - find matching route by color and determine correct opacity
              const routeColor = layer.options.color;
              const matchingRoute = selectedRoutes.find(r => r.color === routeColor);
              if (matchingRoute) {
                const routeGeometry = routeGeometries[matchingRoute.id];
                const targetOpacity = routeGeometry === null ? 0.4 : 0.8;
                layer.setStyle({
                  opacity: targetOpacity,
                  fillOpacity: targetOpacity
                });
                pathElement.style.opacity = String(targetOpacity);
                pathElement.setAttribute('fill-opacity', String(targetOpacity));
              }
            }
          }
        }
      });
    }, 10);

    return () => clearTimeout(timeoutId);
  }, [isFlying, map, isMapReady, selectedRoutes, routeGeometries]);

  // Helper to manage flyTo animation state
  const executeFlyTo = (callback: () => void, durationSeconds: number = 0.4) => {
    // Fade out immediately
    setIsFlying(true);
    isAutomatedMovingRef.current = true;

    callback();

    // Fade back in after animation completes
    setTimeout(() => {
      setIsFlying(false);
      // Give a little extra time for moveend/zoomend to fire before allowing manual clearing
      setTimeout(() => {
        isAutomatedMovingRef.current = false;
      }, 200);
    }, (durationSeconds * 1000) + 50);
  };

  // Constants for mobile map centering
  const MOBILE_BOTTOM_OFFSET_PX = 150; // Manual offset for zoomToPoint
  const MOBILE_PADDING_BOTTOM = 250; // Padding for fitBounds operations

  // Helper to zoom to a point with mobile-aware centering
  const zoomToPoint = (position: L.LatLngExpression, zoom: number = 18) => {
    if (!map) return;

    // Use flyTo for snappy, fluid animation
    const duration = 0.4;
    const flyOptions = { duration, easeLinearity: 0.25 };

    executeFlyTo(() => {
      if (isMobile) {
        // Offset to account for bottom panel on mobile
        const targetPoint = map.project(position, zoom).add([0, MOBILE_BOTTOM_OFFSET_PX]);
        const targetLatLng = map.unproject(targetPoint, zoom);
        map.flyTo(targetLatLng, zoom, flyOptions);
      } else {
        // Direct center on desktop
        map.flyTo(position, zoom, flyOptions);
      }
    }, duration);
  };

  // Unified Zoom/Fit Logic (Intent-Driven)
  useEffect(() => {
    if (!map || !isMapReady || !mapIntent) return;

    console.log('[MapView] Executing map intent:', mapIntent.type, mapIntent.data);
    analyticsService.trackAction('map_intent_execution', { type: mapIntent.type });

    switch (mapIntent.type) {
      case 'DOUBLE_FIT': {
        const activeHome = homeAddress || lookupAddress;
        if (selectedStop && activeHome &&
          validateLngLat(selectedStop.stop.coordinates) &&
          validateLngLat(activeHome.coordinates)) {
          const stopPos = toLeafletPosition(selectedStop.stop.coordinates);
          const homePos = toLeafletPosition(activeHome.coordinates);
          const bounds = L.latLngBounds([stopPos, homePos]);

          // Calculate the target center and zoom level for a "double fit"
          // We want to fit the bounds, but then pull back 2 zoom levels for context.
          const center = bounds.getCenter();

          // Use padding to account for mobile sheet
          const padding: L.PointExpression = isMobile ? [50, MOBILE_PADDING_BOTTOM] : [100, 100];

          // Calculate what the zoom WOULD be if we fit bounds
          const fitZoom = map.getBoundsZoom(bounds, false, L.point(padding as [number, number]));
          const targetZoom = fitZoom - 2;

          // Single, smooth flyTo operation
          const duration = 1.0;
          executeFlyTo(() => {
            if (isMobile) {
              // For manual flyTo, we need to apply the offset manually since flyTo doesn't accept padding
              // We project the center, add the offset, and unproject
              const targetPoint = map.project(center, targetZoom).add([0, MOBILE_BOTTOM_OFFSET_PX]);
              const targetLatLng = map.unproject(targetPoint, targetZoom);
              map.flyTo(targetLatLng, targetZoom, { duration });
            } else {
              map.flyTo(center, targetZoom, { duration }); // Slightly longer duration for drama/clarity
            }
          }, duration);
        } else {
          // Wait for required data
          return;
        }
        break;
      }

      case 'ZOOM_STOP': {
        if (selectedStop && validateLngLat(selectedStop.stop.coordinates)) {
          const position = toLeafletPosition(selectedStop.stop.coordinates);
          zoomToPoint(position, 18);
        } else {
          return;
        }
        break;
      }

      case 'ZOOM_SCHOOL': {
        const schoolId = mapIntent.data?.schoolId || selectedSchoolId;
        const targetSchool = schoolsWithCoords.find(s => s.id === schoolId);
        if (targetSchool && targetSchool.coordinates) {
          const position = toLeafletPosition(targetSchool.coordinates);
          zoomToPoint(position, 18);
        } else {
          return;
        }
        break;
      }

      case 'FIT_ROUTES': {
        const allCoords: [number, number][] = [];
        selectedRoutes.forEach(route => {
          route.stops.forEach(stop => {
            if (stop.coordinates && validateLngLat(stop.coordinates)) {
              allCoords.push(toLeafletPosition(stop.coordinates));
            }
          });
        });

        if (allCoords.length > 0) {
          const bounds = L.latLngBounds(allCoords);
          const duration = 0.4;
          executeFlyTo(() => {
            map.flyToBounds(bounds, {
              paddingTopLeft: [50, 50],
              paddingBottomRight: isMobile ? [50, MOBILE_PADDING_BOTTOM] : [50, 50],
              duration
            });
          }, duration);
        } else {
          return;
        }
        break;
      }

      case 'FIT_HOME': {
        const allCoords: [number, number][] = [];
        selectedRoutes.forEach(route => {
          route.stops.forEach(stop => {
            if (stop.coordinates && validateLngLat(stop.coordinates)) {
              allCoords.push(toLeafletPosition(stop.coordinates));
            }
          });
        });

        if (homeAddress && validateLngLat(homeAddress.coordinates)) {
          const homePos = toLeafletPosition(homeAddress.coordinates);
          allCoords.push(homePos);
          if (mapIntent.data?.showInfo) {
            zoomToPoint(homePos, 18);
          } else if (allCoords.length > 0) {
            const bounds = L.latLngBounds(allCoords);
            const duration = 0.4;
            executeFlyTo(() => {
              map.flyToBounds(bounds, {
                paddingTopLeft: [50, 50],
                paddingBottomRight: isMobile ? [50, MOBILE_PADDING_BOTTOM] : [50, 50],
                duration
              });
            }, duration);
          }
        } else {
          return;
        }
        break;
      }

      case 'FIT_SCHOOLS': {
        const allCoords: [number, number][] = schoolsWithCoords.map((s: School) => [s.coordinates![1], s.coordinates![0]] as [number, number]);
        if (homeAddress && validateLngLat(homeAddress.coordinates)) {
          allCoords.push([homeAddress.coordinates[1], homeAddress.coordinates[0]]);
        }

        if (allCoords.length > 0) {
          const bounds = L.latLngBounds(allCoords);
          const duration = 0.4;
          executeFlyTo(() => {
            map.flyToBounds(bounds, {
              paddingTopLeft: [50, 50],
              paddingBottomRight: isMobile ? [50, MOBILE_PADDING_BOTTOM] : [50, 50],
              duration
            });
          }, duration);
        } else {
          return;
        }
        break;
      }

      case 'MANUAL': {
        if (mapIntent.data) {
          const { lat, lng, zoom } = mapIntent.data;
          const duration = 0.4;
          executeFlyTo(() => {
            // For manual flyTo, we need to apply the offset manually since flyTo doesn't accept padding
            if (isMobile) {
              const targetPoint = map.project([lat, lng], zoom).add([0, MOBILE_BOTTOM_OFFSET_PX]);
              const targetLatLng = map.unproject(targetPoint, zoom);
              map.flyTo(targetLatLng, zoom, { duration });
            } else {
              map.flyTo([lat, lng], zoom, { duration });
            }
          }, duration);
        }
        break;
      }

      case 'STREET_HIGHLIGHT': {
        if (enableStreetHighlighting && highlightedStreet) {
          const bounds = L.latLngBounds(
            [highlightedStreet.bounds.south, highlightedStreet.bounds.west],
            [highlightedStreet.bounds.north, highlightedStreet.bounds.east]
          );
          const duration = 0.4;
          executeFlyTo(() => {
            map.flyToBounds(bounds, {
              paddingTopLeft: [50, 50],
              paddingBottomRight: isMobile ? [50, MOBILE_PADDING_BOTTOM] : [50, 50],
              duration
            });
          }, duration);
        }
        break;
      }
    }

    // Reset initial load ref after first intent execution
    isInitialLoadRef.current = false;

    // Requirement: Clear map intent after it has been handled to prevent redundant executions
    const timeoutId = setTimeout(() => {
      setMapIntent(null);
    }, 100);

    return () => clearTimeout(timeoutId);
  }, [map, isMapReady, mapIntent, schoolsWithCoords, selectedStop, homeAddress, selectedRoutes, directionFilter, highlightedStreet, enableStreetHighlighting, selectedSchoolId, setMapIntent]);

  const activeSchool = selectedSchoolId ? schools.find(s => s.id === selectedSchoolId) : null;
  const schoolHasNoRoutes = !!activeSchool && !isLoading && routes.length === 0;

  // Track "No Routes" state
  useEffect(() => {
    if (schoolHasNoRoutes && activeSchool) {
      analyticsService.trackAction('school_no_routes_viewed', { schoolName: activeSchool.name });
    }
  }, [schoolHasNoRoutes, activeSchool?.id]);

  // Function to recalculate route geometry
  const recalculateRouteGeometry = async (routeId: string) => {
    const route = routes.find(r => r.id === routeId);
    if (!route) {
      console.warn(`[MapView] Route ${routeId} not found`);
      return;
    }

    const stopsWithCoords = route.stops.filter(stop => stop.coordinates && !stop.skipGeocoding);

    if (stopsWithCoords.length < 2) {
      console.log(`[MapView] Route ${route.name} has insufficient stops (${stopsWithCoords.length}), clearing geometry`);
      setRouteGeometries(prev => ({ ...prev, [routeId]: [] }));
      return;
    }

    // Check if route already has cached geometry
    if (route.geometry && route.geometry.length > 0) {
      console.log(`[MapView] 💾 Using cached geometry for ${route.name}: ${route.geometry.length} points`);
      setRouteGeometries(prevState => ({ ...prevState, [routeId]: route.geometry! }));
      return;
    }

    // Mark as loading
    setRouteGeometries(prev => ({ ...prev, [routeId]: null }));
    console.log(`[MapView] 🗺️  Fetching route geometry for ${route.name} (${stopsWithCoords.length} stops)`);

    try {
      // Convert stops to [lng, lat] format for routing service
      const stopCoordinates: [number, number][] = stopsWithCoords.map(stop => {
        if (!validateLngLat(stop.coordinates)) {
          console.error('[MapView] Invalid stop coordinates:', stop.coordinates);
          throw new Error(`Invalid coordinates for stop ${stop.id}`);
        }
        return stop.coordinates!;
      });

      // Fetch route following streets
      const routeCoordinates = await fetchRouteForStops(stopCoordinates);

      if (routeCoordinates && routeCoordinates.length > 0) {
        console.log(`[MapView] ✅ Route geometry fetched for ${route.name}: ${routeCoordinates.length} points`);
        setRouteGeometries(prevState => ({ ...prevState, [routeId]: routeCoordinates }));

        // Save geometry to backend for future use
        try {
          const response = await fetch(`/api/data/routes/${routeId}/geometry`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              geometry: routeCoordinates,
              schoolId: selectedSchoolId,
            }),
          });

          if (response.ok) {
            console.log(`[MapView] 💾 Saved geometry to cache for ${route.name}`);
          } else {
            console.warn(`[MapView] ⚠️  Failed to save geometry cache for ${route.name}: ${response.status}`);
          }
        } catch (saveError) {
          console.error(`[MapView] ❌ Error saving geometry cache for ${route.name}:`, saveError);
        }
      } else {
        throw new Error('Route calculation returned empty coordinates');
      }
    } catch (error: any) {
      console.error(`[MapView] ❌ Error fetching route for ${route.name}:`, error);
      analyticsService.trackError(`Route geometry fetch failed: ${route.name} - ${error.message}`);
      // Fallback to straight line
      const fallbackCoordinates = stopsWithCoords.map(stop => {
        if (!validateLngLat(stop.coordinates)) {
          console.error('[MapView] Invalid stop coordinates for fallback:', stop.coordinates);
          throw new Error(`Invalid coordinates for stop ${stop.id}`);
        }
        return toLeafletPosition(stop.coordinates!);
      });
      console.warn(`[MapView] ⚠️  Using straight-line fallback for ${route.name}`);
      setRouteGeometries(prevState => ({ ...prevState, [routeId]: fallbackCoordinates }));
    }
  };

  // Fetch street-following routes for selected routes
  useEffect(() => {
    const fetchRoutes = async () => {
      if (selectedRoutes.length === 0) {
        console.log('[MapView] No routes selected, skipping route geometry fetch');
        return;
      }

      console.log(`[MapView] 🗺️  Loading route geometry for ${selectedRoutes.length} selected route(s)`);

      for (const route of selectedRoutes) {
        // Check if already loaded using functional update to avoid stale closure
        setRouteGeometries(prev => {
          if (prev[route.id] !== undefined) {
            return prev;
          }

          const stopsWithCoords = route.stops.filter(stop => stop.coordinates && !stop.skipGeocoding);

          if (stopsWithCoords.length < 2) {
            return { ...prev, [route.id]: [] };
          }

          if (route.geometry && route.geometry.length > 0) {
            return { ...prev, [route.id]: route.geometry };
          }

          (async () => {
            await recalculateRouteGeometry(route.id);
          })();

          return { ...prev, [route.id]: null }; // Mark as loading
        });
      }
    };

    fetchRoutes();
  }, [selectedRoutesKey]);

  // Clear states when stop changes
  useEffect(() => {
    if (selectedStop) {
      setUndoHistory(prev =>
        prev.filter(step =>
          step.routeId === selectedStop.route.id && step.stopId === selectedStop.stop.id
        )
      );
    } else {
      setUndoHistory([]);
    }

    setHighlightedStreet(null);
    setLoadingStreet(null);
    setStreetError(null);
    setStreetMarkers([]);
  }, [selectedStop?.route.id, selectedStop?.stop.id]);

  // Function to create a simple pin icon for street markers
  const createStreetPinIcon = (color: string = '#FF6B6B'): L.DivIcon => {
    const iconSize = 20;
    return L.divIcon({
      className: 'street-pin-marker',
      html: `
        <div style="
          width: ${iconSize}px;
          height: ${iconSize}px;
          border-radius: 50%;
          background-color: ${color};
          border: 2px solid white;
          box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        "></div>
      `,
      iconSize: [iconSize, iconSize],
      iconAnchor: [iconSize / 2, iconSize / 2],
      popupAnchor: [0, -iconSize],
    });
  };

  // Function to drop pins for each street in an intersection
  const handleDropStreetPins = async () => {
    if (!selectedStop?.stop.address) return;

    const originalAddress = selectedStop.stop.address;
    const streets = extractStreetNames(originalAddress);

    if (streets.length === 0) return;

    setLoadingStreetPins(true);
    const newMarkers: StreetMarker[] = [];

    try {
      for (let i = 0; i < streets.length; i++) {
        const streetName = streets[i];
        const expandedStreet = expandAddressForGeocoding(streetName);
        const fullAddress = `${expandedStreet}, Portland, OR`;

        try {
          const result = await geocodeAddress(fullAddress, 'Portland', 'OR');
          if (result.coordinates && validateLngLat(result.coordinates)) {
            newMarkers.push({
              streetName: streetName,
              coordinates: result.coordinates,
            });
          }
        } catch (error) {
          console.error(`[MapView] Failed to geocode street "${streetName}":`, error);
        }
      }

      setStreetMarkers(newMarkers);

      if (newMarkers.length > 0 && map) {
        const bounds = L.latLngBounds(
          newMarkers.map(marker => toLeafletPosition(marker.coordinates))
        );
        executeFlyTo(() => {
          map.flyToBounds(bounds, { padding: [50, 50], duration: 0.6 });
        });
      }
    } catch (error) {
      console.error('[MapView] Error dropping street pins:', error);
    } finally {
      setLoadingStreetPins(false);
    }
  };

  // Function to fetch street geometry
  const handleStreetClick = async (streetName: string) => {
    if (!enableStreetHighlighting || loadingStreet || !selectedStop?.stop.coordinates) return;

    setLoadingStreet(streetName);
    setStreetError(null);
    setHighlightedStreet(null);

    try {
      if (!validateLngLat(selectedStop.stop.coordinates)) {
        throw new Error('Invalid stop coordinates');
      }

      const response = await fetch('/api/streets/geometry', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          streetName,
          city: 'Portland',
          state: 'OR',
          stopCoordinates: selectedStop.stop.coordinates,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch street geometry');
      }

      const data = await response.json();

      if (data.success && data.geometry) {
        setHighlightedStreet({
          name: streetName,
          geometry: data.geometry,
          bounds: data.bounds,
        });
      } else {
        throw new Error(data.error || 'Street not found');
      }
    } catch (error: any) {
      console.error(`[MapView] ❌ Error fetching street geometry:`, error);
      setStreetError(error.message || 'Failed to load street');
    } finally {
      setLoadingStreet(null);
    }
  };

  // Function to handle undoing coordinate changes
  const handleUndo = async () => {
    if (!selectedStop) return;
    const lastStep = undoHistory[0];
    if (!lastStep) return;

    const route = routes.find(r => r.id === lastStep.routeId);
    if (!route) return;
    const stop = route.stops.find(s => s.id === lastStep.stopId);
    if (!stop) return;

    setUndoHistory(prev => prev.slice(1));
    updateStopCoordinates(lastStep.routeId, lastStep.stopId, lastStep.coordinates);

    try {
      const response = await fetch(`/api/data/routes/${lastStep.routeId}/stops/${lastStep.stopId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          coordinates: lastStep.coordinates,
          schoolId: selectedSchoolId
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to undo coordinates');
      }

      if (routeRecalcTimeoutRef.current[lastStep.routeId]) {
        clearTimeout(routeRecalcTimeoutRef.current[lastStep.routeId]);
      }

      routeRecalcTimeoutRef.current[lastStep.routeId] = setTimeout(() => {
        recalculateRouteGeometry(lastStep.routeId);
      }, 1000);

      if (selectedStopId === `${route.name}-${stop.id.replace('stop-', '')}`) {
        // Force refresh of selected stop by calling selectStop again
        selectStop(route.name, stop.id);
      }
    } catch (error) {
      console.error('Error undoing coordinates:', error);
      alert('Failed to undo. Please try again.');
    }
  };

  // Default center (Portland, OR)
  const defaultCenter: [number, number] = [45.5152, -122.6784];

  // Improved Stop/School info overlay using MapInfoPanel
  const isPanelOpen = isStopInfoFocused || isSchoolInfoFocused || isHomeInfoFocused || (viewMode === 'schools' && !!selectedSchoolId);
  const displaySchool = isSchoolInfoFocused ? activeSchool || schools.find(s => s.id === selectedSchoolId) : (viewMode === 'schools' ? schools.find(s => s.id === selectedSchoolId) : null);

  return (
    <div style={{ position: 'relative', height: '100%', width: '100%' }}>
      <MapContainer
        center={defaultCenter}
        zoom={12}
        style={{ height: '100%', width: '100%' }}
        ref={setMap}
        zoomControl={false}
      >
        <DarkModeTileLayer />
        <ZoomControl position="bottomleft" />

        {/* Attendance Boundaries Layer */}
        {displayedBoundaries && displayedBoundaries.length > 0 && (
          <GeoJSON
            key={`boundaries-stable-${boundaries ? 'loaded' : 'none'}`}
            data={displayedBoundaries as any}
            style={getBoundaryStyle}
          />
        )}

        {/* Home address marker */}
        {homeAddress && (
          <Marker
            position={[homeAddress.coordinates[1], homeAddress.coordinates[0]]}
            icon={homeIcon}
            eventHandlers={{
              click: () => setFocus('home')
            }}
          />
        )}

        {/* Lookup address marker (temporary) */}
        {lookupAddress && validateLngLat(lookupAddress.coordinates) && (() => {
          const position = toLeafletPosition(lookupAddress.coordinates);
          return (
            <Marker
              position={position}
              icon={defaultMarkerIcon}
              eventHandlers={{
                click: () => {
                  zoomToPoint(position, 18);
                }
              }}
            >
              <Popup>{lookupAddress.address}</Popup>
            </Marker>
          );
        })()}

        {/* School markers */}
        {(() => {
          if (viewMode === 'schools') {
            return schoolsWithCoords.map((school: School) => {
              const isSelected = selectedSchoolId === school.id;
              const schoolTypes = school.schoolTypes || getSchoolTypes(school.name);
              const schoolColor = getSchoolColor(schoolTypes);
              const icon = createSchoolIcon(schoolColor);
              const position = toLeafletPosition(school.curbCoordinates || school.coordinates!);

              return (
                <Marker
                  key={`school-all-${school.id}`}
                  position={position}
                  icon={icon}
                  eventHandlers={{
                    click: () => {
                      setSelectedSchool(school.id);
                      setFocus('school-info');
                    }
                  }}
                  zIndexOffset={isSelected ? 1000 : 0}
                />
              );
            });
          } else {
            if (!activeSchool || !activeSchool.coordinates || !validateLngLat(activeSchool.coordinates)) return null;

            let position = toLeafletPosition(activeSchool.curbCoordinates || activeSchool.coordinates);

            if (selectedRoutes.length > 0) {
              for (const route of selectedRoutes) {
                const geometry = routeGeometries[route.id];
                if (geometry && geometry.length > 0) {
                  const curbPoint = route.direction === 'Afternoon' ? geometry[0] : geometry[geometry.length - 1];
                  if (curbPoint) {
                    position = curbPoint;
                    break;
                  }
                }
              }
            }

            const schoolTypes = activeSchool.schoolTypes || getSchoolTypes(activeSchool.name);
            const schoolColor = getSchoolColor(schoolTypes);

            return (
              <Marker
                key={`school-active-${activeSchool.id}`}
                position={position}
                icon={createSchoolIcon(schoolColor)}
                zIndexOffset={100}
                eventHandlers={{
                  click: () => setFocus('school-info')
                }}
              />
            );
          }
        })()}

        {/* Route lines and stop dots */}
        {viewMode === 'routes' && selectedRoutes.map((route) => {
          const mapStops = getMapStops(route);
          const routeGeometry = routeGeometries[route.id];
          let routeCoordinates: [number, number][];

          if (routeGeometry && routeGeometry.length > 0) {
            routeCoordinates = routeGeometry;
          } else {
            routeCoordinates = mapStops.map(stop => toLeafletPosition(stop.coordinates!));
          }

          const routeOpacity = routeGeometry === null ? 0.4 : 0.8;

          return (
            <React.Fragment key={route.id}>
              {routeCoordinates.length > 1 && (
                <Polyline
                  positions={routeCoordinates}
                  color={route.color}
                  weight={3}
                  opacity={routeOpacity}
                  eventHandlers={{
                    add: (e) => {
                      const layer = e.target as L.Polyline;
                      const element = layer.getElement() as HTMLElement | SVGElement | null;
                      if (element) {
                        element.style.transition = 'opacity 0.2s ease-in-out, fill-opacity 0.2s ease-in-out';
                      }
                    }
                  }}
                />
              )}

              {mapStops.map((stop) => {
                const position = toLeafletPosition(stop.coordinates!);
                const isSelected = selectedStop?.stop.id === stop.id && selectedStop?.route.id === route.id;

                let stopNumber: number;
                let icon: L.DivIcon;

                if (stop.isSchoolStop) {
                  return null;
                } else {
                  stopNumber = calculateStopNumber(route, stop.id);
                  icon = createNumberedIcon(stopNumber, route.color, stop.time, isSelected, editingMode, `${route.id}-${stop.id}`);
                }

                return (
                  <Marker
                    key={`${route.id}-${stop.id}-${route.color}`}
                    position={position}
                    icon={icon}
                    draggable={editingMode}
                    eventHandlers={{
                      click: () => selectStop(route.name, stop.id),
                      ...(editingMode ? {
                        dragend: async (e) => {
                          const marker = e.target;
                          const latlng = marker.getLatLng();
                          const newCoords: [number, number] = [latlng.lng, latlng.lat];
                          if (!validateLngLat(newCoords)) {
                            marker.setLatLng(position);
                            alert('Invalid coordinates. Please try again.');
                            return;
                          }
                          const oldCoords: [number, number] = stop.coordinates!;

                          setUndoHistory(prev => [
                            { routeId: route.id, stopId: stop.id, coordinates: oldCoords },
                            ...prev
                          ].slice(0, 5));

                          updateStopCoordinates(route.id, stop.id, newCoords);

                          try {
                            const response = await fetch(`/api/data/routes/${route.id}/stops/${stop.id}`, {
                              method: 'PUT',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                coordinates: newCoords,
                                schoolId: selectedSchoolId
                              }),
                            });

                            if (!response.ok) throw new Error('Failed to save coordinates');

                            if (routeRecalcTimeoutRef.current[route.id]) {
                              clearTimeout(routeRecalcTimeoutRef.current[route.id]);
                            }

                            routeRecalcTimeoutRef.current[route.id] = setTimeout(() => {
                              recalculateRouteGeometry(route.id);
                            }, 1500);
                          } catch (error) {
                            console.error('Error saving coordinates:', error);
                            marker.setLatLng(position);
                            setUndoHistory(prev => prev.slice(1));
                            alert('Failed to save coordinates. Please try again.');
                          }
                        },
                      } : {}),
                    }}
                  />
                );
              })}
            </React.Fragment>
          );
        })}

        {/* Highlighted street polyline */}
        {enableStreetHighlighting && highlightedStreet && highlightedStreet.geometry.length > 0 && (
          <Polyline
            positions={highlightedStreet.geometry}
            color="#FFD700"
            weight={6}
            opacity={0.4}
            dashArray="0"
          />
        )}

        {/* Street intersection pins */}
        {streetMarkers.map((marker, index) => {
          if (!validateLngLat(marker.coordinates)) return null;
          const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8'];
          const color = colors[index % colors.length];
          const position = toLeafletPosition(marker.coordinates);

          return (
            <Marker
              key={`street-${index}-${marker.streetName}`}
              position={position}
              icon={createStreetPinIcon(color)}
            />
          );
        })}
      </MapContainer>

      <NoRoutesModal
        isOpen={isMobile && schoolHasNoRoutes}
        onClose={() => setSelectedSchool(null)}
        onSelectDifferentSchool={() => {
          analyticsService.trackAction('no_routes_select_different_school');
          setSelectedSchool(null);
        }}
        schoolName={activeSchool?.name}
      />

      {/* Unified Info overlay using MapInfoPanel */}
      <MapInfoPanel
        isOpen={isPanelOpen}
        isFindMyStopVisible={isFindMyStopVisible}
        onClose={() => {
          if (viewMode === 'schools') {
            setSelectedSchool(null);
          } else {
            // clearSelectedStop() already clears both stopId and focus in the URL,
            // so we don't need to call setFocus(null) separately - doing so causes
            // a double URL update race condition that breaks the swipe dismiss behavior
            clearSelectedStop();
          }
        }}
      >
        {isStopInfoFocused && selectedStop ? (
          <StopInfoTooltip
            route={selectedStop.route}
            stop={selectedStop.stop}
            stopNumber={selectedStop.stopNumber}
            enableStreetHighlighting={enableStreetHighlighting}
            highlightedStreetName={highlightedStreet?.name}
            loadingStreet={loadingStreet || undefined}
            streetError={streetError || undefined}
            onStreetClick={handleStreetClick}
            onClose={clearSelectedStop}
            enableStreetPins={enableStreetPins}
            loadingStreetPins={loadingStreetPins}
            onDropStreetPins={handleDropStreetPins}
            editingMode={editingMode}
            undoHistoryCount={undoHistory.length}
            onUndo={handleUndo}
          />
        ) : isHomeInfoFocused && homeAddress ? (
          <HomeInfoTooltip
            address={homeAddress}
            onClose={() => setFocus(null)}
            onClear={() => {
              useStore.getState().clearHomeAddress();
              setFocus(null);
            }}
          />
        ) : isSchoolInfoFocused && displaySchool ? (
          <SchoolInfoTooltip
            school={displaySchool}
            showRoutesButton={true}
            onClose={() => {
              if (viewMode === 'schools') {
                setSelectedSchool(null);
              } else {
                setFocus(null);
              }
            }}
            onViewRoutes={() => {
              viewSchoolRoutes(displaySchool.id);
            }}
          />
        ) : (viewMode === 'schools' && !!selectedSchoolId) ? (() => {
          const school = schools.find(s => s.id === selectedSchoolId);
          return school ? (
            <SchoolInfoTooltip
              school={school}
              showRoutesButton={true}
              onClose={() => setSelectedSchool(null)}
              onViewRoutes={() => {
                viewSchoolRoutes(school.id);
              }}
            />
          ) : null;
        })() : null}
      </MapInfoPanel>

      {/* Boundary Toggles */}
      <div className="leaflet-bottom leaflet-left" style={{
        bottom: isMobile ? (isFindMyStopVisible ? '180px' : '110px') : '110px',
        left: '10px',
        pointerEvents: 'auto',
        zIndex: 1000,
        transition: 'bottom 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
      }}>
        {/* ... (Boundary toggle UI remains the same, uses toggleBoundaryType and toggleAllBoundaries from store) ... */}
        {/* I'll truncate this for brevity as it doesn't change much but use state from store */}
        <div style={{
          display: 'none', // Hidden for now as per original code
          flexDirection: 'column',
          alignItems: 'center',
          gap: (showHighBoundaries || showMiddleBoundaries || showElementaryBoundaries) ? '6px' : '0',
          padding: (showHighBoundaries || showMiddleBoundaries || showElementaryBoundaries) ? '14px 0 0' : '0',
          width: '38px',
          height: (showHighBoundaries || showMiddleBoundaries || showElementaryBoundaries) ? '120px' : '38px',
          justifyContent: (showHighBoundaries || showMiddleBoundaries || showElementaryBoundaries) ? 'flex-start' : 'center',
          backgroundColor: 'rgba(28, 28, 30, 0.6)',
          backdropFilter: 'blur(12px)',
          borderRadius: '999px',
          border: '1px solid rgba(255, 255, 255, 0.01)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
          boxSizing: 'border-box',
          marginBottom: '10px',
          marginLeft: '14px',
        }}>
          {/* Individual Dots Container */}
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px', overflow: 'hidden',
            maxHeight: (showHighBoundaries || showMiddleBoundaries || showElementaryBoundaries) ? '120px' : '0px',
            opacity: (showHighBoundaries || showMiddleBoundaries || showElementaryBoundaries) ? 1 : 0,
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            marginBottom: (showHighBoundaries || showMiddleBoundaries || showElementaryBoundaries) ? '8px' : '0px',
          }}>
            <button onClick={() => toggleBoundaryType('high')} style={{ width: '9.27px', height: '9.27px', borderRadius: '50%', backgroundColor: 'rgba(255, 145, 0, 0.7)', opacity: showHighBoundaries ? 1 : 0.3 }} />
            <button onClick={() => toggleBoundaryType('middle')} style={{ width: '9.27px', height: '9.27px', borderRadius: '50%', backgroundColor: 'rgba(0, 178, 66, 0.7)', opacity: showMiddleBoundaries ? 1 : 0.3 }} />
            <button onClick={() => toggleBoundaryType('elementary')} style={{ width: '9.27px', height: '9.27px', borderRadius: '50%', backgroundColor: 'rgba(0, 153, 250, 0.7)', opacity: showElementaryBoundaries ? 1 : 0.3 }} />
          </div>

          {/* Master Toggle */}
          <button
            onClick={() => toggleAllBoundaries(!(showHighBoundaries || showMiddleBoundaries || showElementaryBoundaries))}
            style={{ background: 'none', border: 'none', padding: (showHighBoundaries || showMiddleBoundaries || showElementaryBoundaries) ? '0px 0px 12px' : '0', cursor: 'pointer', width: '100%', height: (showHighBoundaries || showMiddleBoundaries || showElementaryBoundaries) ? '40px' : '38px' }}
          >
            <svg width="15" height="14" viewBox="0 0 15 14" fill="none">
              <circle cx="7.5" cy="4.6" r="4.6" fill="#FF9100" fillOpacity={showHighBoundaries || showMiddleBoundaries || showElementaryBoundaries ? "0.7" : "0.3"} />
              <circle cx="4.6" cy="9.1" r="4.6" fill="#00B242" fillOpacity={showHighBoundaries || showMiddleBoundaries || showElementaryBoundaries ? "0.7" : "0.3"} />
              <circle cx="10.4" cy="9.1" r="4.6" fill="#0099FA" fillOpacity={showHighBoundaries || showMiddleBoundaries || showElementaryBoundaries ? "0.7" : "0.3"} />
            </svg>
          </button>
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .leaflet-container svg path.leaflet-interactive { transition: opacity 0.2s ease-in-out, fill-opacity 0.2s ease-in-out; }
        
        /* Shift zoom controls up on mobile when "Find My Stop" button is visible */
        @media (max-width: 768px) {
          .leaflet-bottom.leaflet-left .leaflet-control-zoom {
            margin-bottom: ${isFindMyStopVisible ? '80px' : '10px'} !important;
            transition: margin-bottom 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          }
        }
      `}</style>
    </div>
  );
}
