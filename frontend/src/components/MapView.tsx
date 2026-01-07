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
import { geocodeAddress } from '../services/api';
import { toLeafletPosition, validateLngLat, formatCoordinates } from '../utils/coordinates';
import { DarkModeTileLayer } from './DarkModeTileLayer';
import { useIsMobile } from '../hooks/useMediaQuery';
import { analyticsService } from '../services/analytics';
import { MapInfoPanel } from './MapInfoPanel';
import { StopInfoTooltip } from './StopInfoTooltip';
import { SchoolInfoTooltip } from './SchoolInfoTooltip';
import { HomeInfoTooltip } from './HomeInfoTooltip';
import { parseUrlPath, buildUrlPath } from '../services/urlState';
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
    selectedStop,
    clearSelectedStop,
    selectStop,
    selectedSchoolId,
    setSelectedSchool,
    updateStopCoordinates,
    directionFilter,
    isLoading,
    mapIntent,
    setMapIntent,
    boundaries,
    showElementaryBoundaries,
    showMiddleBoundaries,
    showHighBoundaries,
    toggleBoundaryType,
    toggleAllBoundaries,
    assignedSchools
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
  const lastHandledSchoolIdRef = useRef<string | null | undefined>(undefined);
  const [isMapReady, setIsMapReady] = useState(false);
  const isInitialLoadRef = useRef<boolean>(true);

  const previousHomeAddressRef = useRef<typeof homeAddress>(undefined);
  const hasZoomedToAddressRef = useRef<boolean>(false);
  const previousLookupAddressRef = useRef<typeof lookupAddress>(undefined);
  const hasZoomedToLookupAddressRef = useRef<boolean>(false);
  const lastAddressZoomTimeRef = useRef<number>(0);
  const [highlightedStreet, setHighlightedStreet] = useState<HighlightedStreet | null>(null);
  const [loadingStreet, setLoadingStreet] = useState<string | null>(null);
  const [streetError, setStreetError] = useState<string | null>(null);
  const [streetMarkers, setStreetMarkers] = useState<StreetMarker[]>([]);
  const [loadingStreetPins, setLoadingStreetPins] = useState<boolean>(false);
  const [isFlying, setIsFlying] = useState<boolean>(false);

  // Derive info panel state from URL to avoid redundant/stale local state
  const currentUrlState = useMemo(() => parseUrlPath(location.pathname, basePath), [location.pathname, basePath]);
  const isSchoolInfoFocused = currentUrlState.focus === 'school-info';
  const isHomeInfoFocused = currentUrlState.focus === 'home';
  const isStopInfoFocused = !!selectedStop; // selectedStop is already synced from URL by useUrlState

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
    routes.filter(r => r.isSelected && (directionFilter === 'Both' || r.direction === directionFilter))
      .map(r => r.id).sort().join(','),
    [routes, directionFilter]
  );

  // Track if we have successfully fitted the map to the initial set of schools
  const hasInitiallyFittedRef = useRef<boolean>(false);

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
    };

    const onMoveEnd = () => {
      const center = map.getCenter();
      analyticsService.trackAction('map_move', {
        lat: center.lat.toFixed(4),
        lng: center.lng.toFixed(4),
        zoom: map.getZoom()
      });
    };

    const onClick = (e: L.LeafletMouseEvent) => {
      // Only track clicks that aren't on markers (which are handled by marker click handlers)
      if (e.originalEvent.target === map.getContainer() || (e.originalEvent.target as HTMLElement).classList.contains('leaflet-zoom-animated')) {
        analyticsService.trackAction('map_click', {
          lat: e.latlng.lat.toFixed(4),
          lng: e.latlng.lng.toFixed(4)
        });
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
  }, [map]);

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
              const matchingRoute = routes.find(r => r.color === routeColor);
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
  }, [isFlying, map, isMapReady, routes, routeGeometries]);

  // Helper to manage flyTo animation state
  const executeFlyTo = (callback: () => void, durationSeconds: number = 0.4) => {
    // Fade out immediately
    setIsFlying(true);

    callback();

    // Fade back in after animation completes
    setTimeout(() => {
      setIsFlying(false);
    }, (durationSeconds * 1000) + 50); // Slightly longer than animation duration for smooth fade-in
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

    lastAddressZoomTimeRef.current = Date.now();
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

          // No need for a secondary moveend listener anymore

          lastAddressZoomTimeRef.current = Date.now();
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
        const selectedRoutes = routes.filter(r => r.isSelected && (directionFilter === 'Both' || r.direction === directionFilter));
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
        const selectedRoutes = routes.filter(r => r.isSelected && (directionFilter === 'Both' || r.direction === directionFilter));
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
    // and ensure URL focus segments are correctly managed.
    // Use a small timeout to ensure the state update doesn't interfere with the current effect execution
    const timeoutId = setTimeout(() => {
      setMapIntent(null);
    }, 100);

    return () => clearTimeout(timeoutId);
  }, [map, isMapReady, mapIntent, schoolsWithCoords, selectedStop, homeAddress, routes, directionFilter, highlightedStreet, enableStreetHighlighting, selectedSchoolId, setMapIntent]);


  // Get selected routes, filtered by direction
  const selectedRoutes = routes.filter(route => {
    if (!route.isSelected) return false;
    if (directionFilter === 'Both') return true;
    return route.direction === directionFilter;
  });

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
          // Don't fail the whole operation if saving cache fails
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
      const routeIds = selectedRoutes.map(r => r.id).join(',');
      if (!routeIds) {
        console.log('[MapView] No routes selected, skipping route geometry fetch');
        return;
      }

      console.log(`[MapView] 🗺️  Loading route geometry for ${selectedRoutes.length} selected route(s)`);

      for (const route of selectedRoutes) {
        // Check if already loaded using functional update to avoid stale closure
        setRouteGeometries(prev => {
          // Skip if already loaded (including empty arrays for routes with < 2 stops)
          if (prev[route.id] !== undefined) {
            console.log(`[MapView] Route ${route.name} geometry already loaded, skipping`);
            return prev;
          }

          const stopsWithCoords = route.stops.filter(stop => stop.coordinates && !stop.skipGeocoding);

          if (stopsWithCoords.length < 2) {
            // Not enough stops for a route
            console.log(`[MapView] Route ${route.name} has insufficient stops (${stopsWithCoords.length}), skipping`);
            return { ...prev, [route.id]: [] };
          }

          // Check if route has cached geometry from backend
          if (route.geometry && route.geometry.length > 0) {
            console.log(`[MapView] 💾 Using cached geometry for ${route.name}`);
            return { ...prev, [route.id]: route.geometry };
          }

          // Mark as loading and fetch route asynchronously
          (async () => {
            await recalculateRouteGeometry(route.id);
          })();

          return { ...prev, [route.id]: null }; // Mark as loading
        });
      }

    };

    fetchRoutes();
  }, [selectedRoutes.map(r => r.id).join(',')]); // Re-fetch when selected routes change

  // Calculate bounds to fit all routes when coordinates are available
  // Zoom to selected stop when it changes (non-movement logic)
  useEffect(() => {
    // Clear undo history when a different stop is selected
    // (only keep history for the currently selected stop)
    if (selectedStop) {
      setUndoHistory(prev =>
        prev.filter(step =>
          step.routeId === selectedStop.route.id && step.stopId === selectedStop.stop.id
        )
      );
    } else {
      // Clear all history when no stop is selected
      setUndoHistory([]);
    }

    // Clear highlighted street when stop changes
    setHighlightedStreet(null);
    setLoadingStreet(null);
    setStreetError(null);
    // Clear street markers when stop changes
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
    console.log('[MapView] Original address:', originalAddress);

    const streets = extractStreetNames(originalAddress);
    console.log('[MapView] Extracted streets:', streets);

    if (streets.length === 0) return;

    setLoadingStreetPins(true);
    const newMarkers: StreetMarker[] = [];

    try {
      // Geocode each street
      for (let i = 0; i < streets.length; i++) {
        const streetName = streets[i];
        console.log(`[MapView] Processing street ${i + 1}: "${streetName}"`);

        const expandedStreet = expandAddressForGeocoding(streetName);
        console.log(`[MapView] Expanded street: "${expandedStreet}"`);

        const fullAddress = `${expandedStreet}, Portland, OR`;
        console.log(`[MapView] Full geocoding query: "${fullAddress}"`);

        try {
          const result = await geocodeAddress(fullAddress, 'Portland', 'OR');
          console.log(`[MapView] Geocoding result for "${streetName}":`, {
            success: !!result.coordinates,
            coordinates: result.coordinates,
            displayName: result.displayName
          });

          if (result.coordinates) {
            // Validate coordinates format
            if (!validateLngLat(result.coordinates)) {
              console.error(`[MapView] Invalid coordinates returned for "${streetName}":`, result.coordinates);
              console.error(`[MapView] Geocoding query was: "${fullAddress}"`);
              console.error(`[MapView] Result displayName: "${result.displayName}"`);
              // Continue with other streets even if one has invalid coordinates
              continue;
            }

            console.log(`[MapView] ✅ Valid coordinates for "${streetName}": ${formatCoordinates(result.coordinates)}`);
            newMarkers.push({
              streetName: streetName,
              coordinates: result.coordinates, // [lng, lat] - validated
            });
          }
        } catch (error) {
          console.error(`[MapView] Failed to geocode street "${streetName}":`, error);
          // Continue with other streets even if one fails
        }
      }

      setStreetMarkers(newMarkers);

      // Zoom to fit all markers if we have any
      if (newMarkers.length > 0 && map) {
        const bounds = L.latLngBounds(
          newMarkers.map(marker => {
            if (!validateLngLat(marker.coordinates)) {
              console.error('[MapView] Invalid marker coordinates:', marker.coordinates);
              throw new Error(`Invalid coordinates for marker ${marker.streetName}`);
            }
            return toLeafletPosition(marker.coordinates);
          })
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

  // Function to fetch street geometry (only enabled if enableStreetHighlighting is true)
  const handleStreetClick = async (streetName: string) => {
    if (!enableStreetHighlighting) return; // Feature disabled
    if (loadingStreet) return; // Prevent multiple simultaneous requests
    if (!selectedStop?.stop.coordinates) {
      console.warn('[MapView] No stop coordinates available for street highlighting');
      return;
    }

    setLoadingStreet(streetName);
    setStreetError(null);
    setHighlightedStreet(null);

    try {
      console.log(`[MapView] Fetching geometry for street: ${streetName}`);

      // Pass stop coordinates so we can find the correct street segment
      if (!validateLngLat(selectedStop.stop.coordinates)) {
        console.error('[MapView] Invalid stop coordinates for street geometry:', selectedStop.stop.coordinates);
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
          stopCoordinates: selectedStop.stop.coordinates, // [lng, lat] format
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch street geometry');
      }

      const data = await response.json();

      if (data.success && data.geometry) {
        console.log(`[MapView] ✅ Street geometry loaded: ${data.geometry.length} points`);
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

    // Find the route and stop
    const route = routes.find(r => r.id === lastStep.routeId);
    if (!route) return;
    const stop = route.stops.find(s => s.id === lastStep.stopId);
    if (!stop) return;

    // Remove from undo history
    setUndoHistory(prev => prev.slice(1));

    // Restore coordinates
    updateStopCoordinates(lastStep.routeId, lastStep.stopId, lastStep.coordinates);

    // Save to API
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

      // Recalculate route geometry after 1 second
      if (routeRecalcTimeoutRef.current[lastStep.routeId]) {
        clearTimeout(routeRecalcTimeoutRef.current[lastStep.routeId]);
      }

      routeRecalcTimeoutRef.current[lastStep.routeId] = setTimeout(() => {
        recalculateRouteGeometry(lastStep.routeId);
      }, 1000);

      // Update selected stop if it's the one being undone
      if (selectedStop && selectedStop.route.id === lastStep.routeId && selectedStop.stop.id === lastStep.stopId) {
        selectStop(route, stop, selectedStop.stopNumber);
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
  const displaySchool = isSchoolInfoFocused ? activeSchool || schools.find(s => s.id === currentUrlState.schoolId) : (viewMode === 'schools' ? schools.find(s => s.id === selectedSchoolId) : null);

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
            key={`boundaries-stable-${boundaries ? 'loaded' : 'none'}`} // Stable key for transitions
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
              click: () => {
                const urlState = parseUrlPath(location.pathname, basePath);
                const newState = { ...urlState, focus: 'home' };
                navigate(buildUrlPath(basePath, newState));
              }
            }}
          />
        )}

        {/* Lookup address marker (temporary) */}
        {lookupAddress && (() => {
          if (!validateLngLat(lookupAddress.coordinates)) {
            console.error('[MapView] Invalid lookup address coordinates:', lookupAddress.coordinates);
            return null;
          }
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

        {/* School markers - show all in 'schools' view, only active in 'routes' view */}
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
                      const urlState = parseUrlPath(location.pathname, basePath);
                      const newState = { ...urlState, schoolId: school.id, focus: 'school-info' };
                      navigate(buildUrlPath(basePath, newState));
                    }
                  }}
                  zIndexOffset={isSelected ? 1000 : 0}
                />
              );
            });
          } else {
            // Routes view - only show active school
            if (!activeSchool || !activeSchool.coordinates) return null;
            if (!validateLngLat(activeSchool.coordinates)) return null;

            // Try to get curb position from route geometry if available, 
            // otherwise use the snapped coordinates from schools.json
            let position = toLeafletPosition(activeSchool.curbCoordinates || activeSchool.coordinates);

            if (selectedRoutes.length > 0) {
              // Find the first route that has street-snapped geometry
              for (const route of selectedRoutes) {
                const geometry = routeGeometries[route.id];
                if (geometry && geometry.length > 0) {
                  // Morning routes end at school (last point), Afternoon start there (first point)
                  // geometry is [lat, lng][] for Leaflet
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
                  click: () => {
                    const urlState = parseUrlPath(location.pathname, basePath);
                    const newState = { ...urlState, schoolId: activeSchool.id, focus: 'school-info' };
                    navigate(buildUrlPath(basePath, newState));
                  }
                }}
              />
            );
          }
        })()}

        {/* Route lines and stop dots - ONLY show in routes view */}
        {viewMode === 'routes' && selectedRoutes.map((route) => {
          // Get stops with coordinates in order, excluding skipped stops (e.g., CAB LOAD ZONE)
          const stopsWithCoords = route.stops.filter(stop => stop.coordinates && !stop.skipGeocoding);

          // Get street-following route geometry, or fallback to straight line
          const routeGeometry = routeGeometries[route.id];
          let routeCoordinates: [number, number][];

          if (routeGeometry && routeGeometry.length > 0) {
            // Use street-following route
            routeCoordinates = routeGeometry;
          } else if (routeGeometry === null) {
            // Still loading - show straight line as placeholder
            routeCoordinates = stopsWithCoords.map(stop => {
              if (!validateLngLat(stop.coordinates)) {
                console.error('[MapView] Invalid stop coordinates:', stop.coordinates);
                throw new Error(`Invalid coordinates for stop ${stop.id}`);
              }
              return toLeafletPosition(stop.coordinates!);
            });
          } else {
            // Not loaded yet - show straight line
            routeCoordinates = stopsWithCoords.map(stop => {
              if (!validateLngLat(stop.coordinates)) {
                console.error('[MapView] Invalid stop coordinates:', stop.coordinates);
                throw new Error(`Invalid coordinates for stop ${stop.id}`);
              }
              return toLeafletPosition(stop.coordinates!);
            });
          }

          // Opacity is managed by the useEffect that watches isFlying
          // We still set initial opacity here for when not flying
          const routeOpacity = routeGeometry === null ? 0.4 : 0.8;

          return (
            <React.Fragment key={route.id}>
              {/* Route polyline - follows streets when available */}
              {routeCoordinates.length > 1 && (
                <Polyline
                  positions={routeCoordinates}
                  color={route.color}
                  weight={3}
                  opacity={routeOpacity}
                  eventHandlers={{
                    add: (e) => {
                      // Store reference to the layer for opacity updates
                      const layer = e.target as L.Polyline;
                      // Apply transition style via DOM manipulation
                      const element = layer.getElement() as HTMLElement | SVGElement | null;
                      if (element) {
                        element.style.transition = 'opacity 0.2s ease-in-out, fill-opacity 0.2s ease-in-out';
                      }
                    }
                  }}
                />
              )}

              {/* Stop markers with numbers */}
              {stopsWithCoords.map((stop) => {
                // Convert [lng, lat] to [lat, lng] for Leaflet
                if (!validateLngLat(stop.coordinates)) {
                  console.error('[MapView] Invalid stop coordinates, skipping marker:', stop.coordinates);
                  return null;
                }
                const position = toLeafletPosition(stop.coordinates!);
                const isSelected = selectedStop?.stop.id === stop.id && selectedStop?.route.id === route.id;

                // Determine stop number and icon
                let stopNumber: number;
                let icon: L.DivIcon;

                if (stop.isSchoolStop) {
                  // Skip rendering individual school pins - the main landmark pin handles this
                  return null;
                } else {
                  // Regular stop: calculate number by counting only non-school, non-skipped stops before this one
                  const allStopsWithCoords = route.stops.filter(s => s.coordinates && !s.skipGeocoding);
                  const currentIndexInAllStops = allStopsWithCoords.findIndex(s => s.id === stop.id);
                  // Count how many regular (non-school, non-skipped) stops come before this one
                  let regularStopCount = 0;
                  for (let i = 0; i < currentIndexInAllStops; i++) {
                    const s = allStopsWithCoords[i];
                    if (!s.isSchoolStop && !s.skipGeocoding) {
                      regularStopCount++;
                    }
                  }
                  stopNumber = regularStopCount + 1; // Number starts at 1
                  icon = createNumberedIcon(stopNumber, route.color, stop.time, isSelected, editingMode, `${route.id}-${stop.id}`);
                }

                return (
                  <Marker
                    key={`${route.id}-${stop.id}-${route.color}`}
                    position={position}
                    icon={icon}
                    draggable={editingMode}
                    eventHandlers={{
                      click: () => {
                        const urlState = parseUrlPath(location.pathname, basePath);
                        const stopId = stop.id.match(/stop-(\d+)/) ? stop.id.match(/stop-(\d+)/)![1] : stop.id;
                        const formattedStopId = route.name.endsWith('-upcoming')
                          ? `${route.name.replace('-upcoming', '')}-${stopId}-upcoming`
                          : `${route.name}-${stopId}`;

                        const newState = { ...urlState, stopId: formattedStopId, focus: undefined };
                        navigate(buildUrlPath(basePath, newState));
                      },
                      ...(editingMode ? {
                        dragend: async (e) => {
                          const marker = e.target;
                          const latlng = marker.getLatLng();
                          // Leaflet gives us [lat, lng], convert to internal [lng, lat] format
                          const newCoords: [number, number] = [latlng.lng, latlng.lat];
                          if (!validateLngLat(newCoords)) {
                            console.error('[MapView] Invalid new coordinates from drag:', newCoords);
                            marker.setLatLng(position);
                            alert('Invalid coordinates. Please try again.');
                            return;
                          }
                          const oldCoords: [number, number] = stop.coordinates!;
                          if (!validateLngLat(oldCoords)) {
                            console.error('[MapView] Invalid old coordinates:', oldCoords);
                            return;
                          }

                          // Add to undo history (keep max 5 steps)
                          setUndoHistory(prev => {
                            const newHistory = [
                              { routeId: route.id, stopId: stop.id, coordinates: oldCoords },
                              ...prev
                            ];
                            return newHistory.slice(0, 5); // Keep only last 5 steps
                          });

                          // Update store immediately for responsive UI
                          updateStopCoordinates(route.id, stop.id, newCoords);

                          // Save to API
                          try {
                            const response = await fetch(`/api/data/routes/${route.id}/stops/${stop.id}`, {
                              method: 'PUT',
                              headers: {
                                'Content-Type': 'application/json',
                              },
                              body: JSON.stringify({
                                coordinates: newCoords,
                                schoolId: selectedSchoolId
                              }),
                            });

                            if (!response.ok) {
                              throw new Error('Failed to save coordinates');
                            }

                            // Schedule route recalculation after 1.5 second delay
                            // Clear any existing timeout for this route
                            if (routeRecalcTimeoutRef.current[route.id]) {
                              clearTimeout(routeRecalcTimeoutRef.current[route.id]);
                            }

                            routeRecalcTimeoutRef.current[route.id] = setTimeout(() => {
                              recalculateRouteGeometry(route.id);
                            }, 1500);
                          } catch (error) {
                            console.error('Error saving coordinates:', error);
                            // Revert the marker position on error
                            marker.setLatLng(position);
                            // Remove from undo history since save failed
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

        {/* Highlighted street polyline - only show if feature is enabled */}
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
          if (!validateLngLat(marker.coordinates)) {
            console.error('[MapView] Invalid street marker coordinates, skipping:', marker.coordinates);
            return null;
          }
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

      {/* Centered "NO ROUTES" overlay on mobile when school has no routes */}
      {isMobile && schoolHasNoRoutes && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          pointerEvents: 'auto', // Enable interaction for button
          padding: '2rem',
          textAlign: 'center',
          color: 'var(--text-secondary)',
          backgroundColor: 'rgba(0, 0, 0, 0.4)', // Dark overlay to match image
          backdropFilter: 'blur(4px)',
        }}>
          <div style={{
            backgroundColor: 'var(--bg-primary)',
            padding: '2rem',
            borderRadius: '20px',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            maxWidth: '300px',
            width: '100%',
          }}>
            <div style={{
              backgroundColor: 'rgba(244, 67, 54, 0.1)',
              color: '#f44',
              fontSize: '14px',
              padding: '8px 20px',
              borderRadius: '999px',
              fontWeight: '700',
              textTransform: 'uppercase',
              border: '1px solid rgba(244, 67, 54, 0.3)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '1.5rem'
            }}>
              <i className="fas fa-exclamation-triangle" style={{ fontSize: '14px' }}></i>
              NO ROUTES
            </div>
            <p style={{
              fontSize: '16px',
              fontWeight: '500',
              margin: 0,
              marginBottom: '1.5rem',
              color: 'var(--text-secondary)',
              lineHeight: '1.4'
            }}>
              Route information not provided on the web by school district.
            </p>
            <button
              onClick={() => {
                analyticsService.trackAction('no_routes_select_different_school');
                setSelectedSchool(null);
              }}
              style={{
                padding: '0.75rem 1.5rem',
                backgroundColor: 'var(--bg-primary)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-color)',
                borderRadius: '9999px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '600',
                transition: 'all 0.2s ease',
                width: '100%',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--bg-secondary)';
                e.currentTarget.style.borderColor = 'var(--text-tertiary)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--bg-primary)';
                e.currentTarget.style.borderColor = 'var(--border-color)';
              }}
            >
              Select Different School
            </button>
          </div>
        </div>
      )}

      {/* Unified Info overlay using MapInfoPanel */}
      <MapInfoPanel
        isOpen={isPanelOpen}
        onClose={() => {
          const urlState = parseUrlPath(location.pathname, basePath);
          const newState = { ...urlState, stopId: undefined, focus: undefined };
          // If we are in schools mode, closing the panel should clear school selection
          if (viewMode === 'schools') {
            newState.schoolId = undefined;
          }
          navigate(buildUrlPath(basePath, newState));
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
            onClose={() => {
              const urlState = parseUrlPath(location.pathname, basePath);
              const newState = { ...urlState, stopId: undefined, focus: undefined };
              navigate(buildUrlPath(basePath, newState));
            }}
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
            onClose={() => {
              const urlState = parseUrlPath(location.pathname, basePath);
              const newState = { ...urlState, focus: undefined };
              navigate(buildUrlPath(basePath, newState));
            }}
            onClear={() => {
              useStore.getState().clearHomeAddress();
              const urlState = parseUrlPath(location.pathname, basePath);
              const newState = { ...urlState, focus: undefined };
              navigate(buildUrlPath(basePath, newState));
            }}
          />
        ) : isSchoolInfoFocused && displaySchool ? (
          <SchoolInfoTooltip
            school={displaySchool}
            showRoutesButton={true} // Always show routes button in dialog if accessible
            onClose={() => {
              const urlState = parseUrlPath(location.pathname, basePath);
              const newState = { ...urlState, focus: undefined };
              // On schools tab, closing the dialog should clear the school selection entirely
              if (viewMode === 'schools') {
                newState.schoolId = undefined;
              }
              navigate(buildUrlPath(basePath, newState));
            }}
            onViewRoutes={() => {
              // This is now handled by SchoolInfoTooltip using buildUrlPath internally
              // but we can ensure it switches tab if needed.
              // useUrlState will handle the tab switch if the URL changes to /routes.
            }}
          />
        ) : (viewMode === 'schools' && !!selectedSchoolId) ? (() => {
          const school = schools.find(s => s.id === selectedSchoolId);
          return school ? (
            <SchoolInfoTooltip
              school={school}
              showRoutesButton={true}
              onClose={() => {
                const urlState = parseUrlPath(location.pathname, basePath);
                const newState = { ...urlState, schoolId: undefined, focus: undefined };
                navigate(buildUrlPath(basePath, newState));
              }}
            />
          ) : null;
        })() : null}
      </MapInfoPanel>

      {/* Boundary Toggle Redesign in Bottom Left */}
      <div className="leaflet-bottom leaflet-left" style={{ bottom: '110px', left: '10px', pointerEvents: 'auto', zIndex: 1000 }}>
        <div style={{
          display: 'none',
          flexDirection: 'column',
          alignItems: 'center',
          gap: (showHighBoundaries || showMiddleBoundaries || showElementaryBoundaries) ? '16px' : '0',
          padding: (showHighBoundaries || showMiddleBoundaries || showElementaryBoundaries) ? '16px 0 0' : '0',
          width: '38px',
          height: (showHighBoundaries || showMiddleBoundaries || showElementaryBoundaries) ? '160px' : '38px',
          justifyContent: (showHighBoundaries || showMiddleBoundaries || showElementaryBoundaries) ? 'flex-start' : 'center',
          backgroundColor: 'rgba(28, 28, 30, 0.6)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          borderRadius: '999px',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          boxSizing: 'border-box',
        }}>
          {/* Individual Dots Container (Animated) */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '16px',
            overflow: 'hidden',
            maxHeight: (showHighBoundaries || showMiddleBoundaries || showElementaryBoundaries) ? '120px' : '0px',
            opacity: (showHighBoundaries || showMiddleBoundaries || showElementaryBoundaries) ? 1 : 0,
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            marginBottom: (showHighBoundaries || showMiddleBoundaries || showElementaryBoundaries) ? '8px' : '0px',
          }}>
            <button
              onClick={() => toggleBoundaryType('high')}
              title="Toggle High School Boundaries"
              style={{
                width: '9.27px',
                height: '9.27px',
                borderRadius: '50%',
                backgroundColor: 'rgba(255, 145, 0, 0.7)',
                border: '1.54545px solid rgba(255, 145, 0, 0.7)',
                boxSizing: 'border-box',
                padding: 0,
                cursor: 'pointer',
                opacity: showHighBoundaries ? 1 : 0.3,
                transition: 'opacity 0.2s ease',
              }}
            />
            <button
              onClick={() => toggleBoundaryType('middle')}
              title="Toggle Middle School Boundaries"
              style={{
                width: '9.27px',
                height: '9.27px',
                borderRadius: '50%',
                backgroundColor: 'rgba(0, 178, 66, 0.7)',
                border: '1.54545px solid rgba(0, 178, 66, 0.7)',
                boxSizing: 'border-box',
                padding: 0,
                cursor: 'pointer',
                opacity: showMiddleBoundaries ? 1 : 0.3,
                transition: 'opacity 0.2s ease',
              }}
            />
            <button
              onClick={() => toggleBoundaryType('elementary')}
              title="Toggle Elementary Boundaries"
              style={{
                width: '9.27px',
                height: '9.27px',
                borderRadius: '50%',
                backgroundColor: 'rgba(0, 153, 250, 0.7)',
                border: '1.54545px solid rgba(0, 153, 250, 0.7)',
                boxSizing: 'border-box',
                padding: 0,
                cursor: 'pointer',
                opacity: showElementaryBoundaries ? 1 : 0.3,
                transition: 'opacity 0.2s ease',
              }}
            />
          </div>

          {/* Master Toggle (Cluster Icon) */}
          <button
            onClick={() => toggleAllBoundaries(!(showHighBoundaries || showMiddleBoundaries || showElementaryBoundaries))}
            title={showHighBoundaries || showMiddleBoundaries || showElementaryBoundaries ? "Turn Off All Boundaries" : "Turn On All Boundaries"}
            style={{
              background: 'none',
              border: 'none',
              padding: (showHighBoundaries || showMiddleBoundaries || showElementaryBoundaries) ? '0px 0px 12px' : '0',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '50%',
              transition: 'all 0.2s ease',
              width: '100%',
              height: (showHighBoundaries || showMiddleBoundaries || showElementaryBoundaries) ? '40px' : '38px',
              marginTop: 'auto'
            }}
          >
            <svg width="15" height="14" viewBox="0 0 15 14" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="7.50001" cy="4.63636" r="4.63636" fill="#FF9100" fillOpacity={showHighBoundaries || showMiddleBoundaries || showElementaryBoundaries ? "0.7" : "0.3"} />
              <circle cx="7.50001" cy="4.63636" r="3.86364" stroke="#FF9100" strokeOpacity={showHighBoundaries || showMiddleBoundaries || showElementaryBoundaries ? "0.7" : "0.3"} strokeWidth="1.54545" />
              <circle cx="4.63636" cy="9.09091" r="4.63636" fill="#00B242" fillOpacity={showHighBoundaries || showMiddleBoundaries || showElementaryBoundaries ? "0.7" : "0.3"} />
              <circle cx="4.63636" cy="9.09091" r="3.86364" stroke="#00B242" strokeOpacity={showHighBoundaries || showMiddleBoundaries || showElementaryBoundaries ? "0.7" : "0.3"} strokeWidth="1.54545" />
              <circle cx="10.3637" cy="9.09091" r="4.63636" fill="#0099FA" fillOpacity={showHighBoundaries || showMiddleBoundaries || showElementaryBoundaries ? "0.7" : "0.3"} />
              <circle cx="10.3637" cy="9.09091" r="3.86364" stroke="#0099FA" strokeOpacity={showHighBoundaries || showMiddleBoundaries || showElementaryBoundaries ? "0.7" : "0.3"} strokeWidth="1.54545" />
            </svg>
          </button>
        </div>
      </div>

      {/* Loading spinner animation */}
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        /* Smooth opacity transitions for route polylines during flyTo animations */
        .leaflet-container svg path.leaflet-interactive {
          transition: opacity 0.2s ease-in-out, fill-opacity 0.2s ease-in-out;
        }

        /* Style Zoom Control to match boundary control */
        .leaflet-control-zoom {
          border: none !important;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3) !important;
          background-color: rgba(28, 28, 30, 0.6) !important;
          backdrop-filter: blur(12px) !important;
          -webkit-backdrop-filter: blur(12px) !important;
          border: 1px solid rgba(255, 255, 255, 0.1) !important;
          border-radius: 999px !important;
          overflow: hidden !important;
          display: flex !important;
          flex-direction: column !important;
          width: 38px !important;
        }

        .leaflet-control-zoom-in, .leaflet-control-zoom-out {
          background-color: transparent !important;
          color: rgba(255, 255, 255, 0.8) !important;
          border: none !important;
          width: 38px !important;
          height: 38px !important;
          line-height: 38px !important;
          font-size: 16px !important;
          transition: all 0.2s ease !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          text-decoration: none !important;
        }

        /* Border between the zoom buttons - using a pseudo element for precision */
        .leaflet-control-zoom-in {
          position: relative;
        }
        .leaflet-control-zoom-in::after {
          content: "";
          position: absolute;
          bottom: 0;
          left: 6px;
          right: 6px;
          height: 1px;
          background-color: rgba(255, 255, 255, 0.1);
        }

        .leaflet-control-zoom-out {
          border-bottom: none !important;
        }

        .leaflet-control-zoom-out {
          border-bottom: none !important;
        }

        .leaflet-control-zoom-in:hover, .leaflet-control-zoom-out:hover {
          background-color: rgba(255, 255, 255, 0.1) !important;
          color: #FFFFFF !important;
        }
      `}</style>
    </div>
  );
}

