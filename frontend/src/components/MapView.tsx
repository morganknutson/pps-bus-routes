import React, { useEffect, useRef, useState, useMemo } from 'react';
import { MapContainer, Polyline, Marker, Popup, ZoomControl } from 'react-leaflet';
import L from 'leaflet';
import { useStore } from '../store/useStore';
import { fetchRouteForStops } from '../services/routing';
import { School } from '../types';
import { formatStreetName, extractStreetNames, expandAddressForGeocoding } from '../utils/formatAddress';
import { createHomeIcon, createDefaultMarkerIcon } from '../utils/fontAwesomeIcons';
import { createSchoolIcon, createNumberedIcon } from '../utils/markerIcons';
import { getSchoolTypes, getSchoolColor } from '../utils/schoolUtils';
import { geocodeAddress } from '../services/api';
import { toLeafletPosition, validateLngLat, formatCoordinates } from '../utils/coordinates';
import { DarkModeTileLayer } from './DarkModeTileLayer';
import { useIsMobile } from '../hooks/useMediaQuery';
import { MapInfoPanel } from './MapInfoPanel';
import { StopInfoTooltip } from './StopInfoTooltip';
import { SchoolInfoTooltip } from './SchoolInfoTooltip';
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
    isLoading 
  } = useStore();

  const schools = schoolsProp || schoolsFromStore;
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
  const previousLookupAddressRef = useRef<{ address: string; coordinates: [number, number] } | null>(null);
  const hasZoomedToLookupAddressRef = useRef<boolean>(false);
  const lastAddressZoomTimeRef = useRef<number>(0);
  const [highlightedStreet, setHighlightedStreet] = useState<HighlightedStreet | null>(null);
  const [loadingStreet, setLoadingStreet] = useState<string | null>(null);
  const [streetError, setStreetError] = useState<string | null>(null);
  const [streetMarkers, setStreetMarkers] = useState<StreetMarker[]>([]);
  const [loadingStreetPins, setLoadingStreetPins] = useState<boolean>(false);
  const [showSchoolInfo, setShowSchoolInfo] = useState<boolean>(false);

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

  // Track if we have successfully fitted the map to the initial set of schools
  const hasInitiallyFittedRef = useRef<boolean>(false);

  // Mark map as ready
  useEffect(() => {
    if (!map) return;
    const checkReady = () => {
      if (map.getContainer()) {
        console.log('[MapView] Map container ready');
        setIsMapReady(true);
      }
    };
    map.whenReady(checkReady);
    checkReady();
  }, [map]);

  // Unified Zoom/Fit Logic
  useEffect(() => {
    if (!map || !isMapReady) return;

    // Give priority to manual address zoom
    const timeSinceAddressZoom = Date.now() - lastAddressZoomTimeRef.current;
    if (timeSinceAddressZoom < 2000) return;

    const isStateChanged = lastHandledSchoolIdRef.current !== selectedSchoolId;
    const isFirstLoad = isInitialLoadRef.current;

    // Handle Route View Zooming
    if (viewMode === 'routes') {
      if (selectedStop) {
        // Stop selected - zoom to stop
        if (!validateLngLat(selectedStop.stop.coordinates)) return;
        const position = toLeafletPosition(selectedStop.stop.coordinates);
        map.setView(position, 18, { animate: true });
        lastHandledSchoolIdRef.current = 'STOP_SELECTED';
        return;
      }

      const selectedRoutes = routes.filter(r => r.isSelected && (directionFilter === 'Both' || r.direction === directionFilter));
      
      if (selectedRoutes.length > 0) {
        // Routes selected - fit to routes
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
          map.fitBounds(bounds, { padding: [50, 50], animate: true });
          lastHandledSchoolIdRef.current = 'ROUTES_FIT';
        }
      } else if (selectedSchoolId) {
        // No routes but school selected - zoom to school
        const school = schoolsWithCoords.find(s => s.id === selectedSchoolId);
        if (school && school.coordinates) {
          const [lng, lat] = school.coordinates;
          const zoom = 16;
          // Offset to account for bottom panel
          const targetPoint = map.project([lat, lng], zoom).add([0, 100]);
          const targetLatLng = map.unproject(targetPoint, zoom);
          map.setView(targetLatLng, zoom, { animate: true });
          lastHandledSchoolIdRef.current = selectedSchoolId;
        }
      } else {
        // No school selected in routes mode - this usually happens during transition
        // We don't do anything here, wait for viewMode to change to 'schools'
      }
    } 
    // Handle Schools View Zooming
    else if (viewMode === 'schools') {
      if (selectedSchoolId) {
        // Zoom to single school
        if (!isStateChanged && !isFirstLoad && lastHandledSchoolIdRef.current === selectedSchoolId) return;
        const school = schoolsWithCoords.find(s => s.id === selectedSchoolId);
        if (school && school.coordinates) {
          const [lng, lat] = school.coordinates;
          const zoom = 16;
          const targetPoint = map.project([lat, lng], zoom).add([0, 100]);
          const targetLatLng = map.unproject(targetPoint, zoom);
          map.setView(targetLatLng, zoom, { animate: true });
          lastHandledSchoolIdRef.current = selectedSchoolId;
        }
      } else {
        // Fit all schools
        const wasSelectedBefore = lastHandledSchoolIdRef.current !== null && lastHandledSchoolIdRef.current !== undefined;
        // If we just loaded schools for the first time, or if we were zoomed in and now aren't
        if (wasSelectedBefore || isFirstLoad || isStateChanged || (!hasInitiallyFittedRef.current && schoolsWithCoords.length > 0)) {
          const allCoords: [number, number][] = schoolsWithCoords.map((s: School) => [s.coordinates![1], s.coordinates![0]] as [number, number]);
          if (homeAddress) allCoords.push([homeAddress.coordinates[1], homeAddress.coordinates[0]]);
          
          if (allCoords.length > 0) {
            const bounds = L.latLngBounds(allCoords);
            map.fitBounds(bounds, { padding: [50, 50], animate: true });
            lastHandledSchoolIdRef.current = null;
            hasInitiallyFittedRef.current = true;
          }
        }
      }
    }

    isInitialLoadRef.current = false;
  }, [map, isMapReady, viewMode, selectedSchoolId, selectedStop, routes, directionFilter, schoolsWithCoords, homeAddress, schoolsKey]);

  // Clear school info tooltip when a stop is selected
  useEffect(() => {
    if (selectedStop) {
      setShowSchoolInfo(false);
    }
  }, [selectedStop]);

  // Clear everything when school changes
  useEffect(() => {
    setShowSchoolInfo(false);
  }, [selectedSchoolId]);

  // Get selected routes, filtered by direction
  const selectedRoutes = routes.filter(route => {
    if (!route.isSelected) return false;
    if (directionFilter === 'Both') return true;
    return route.direction === directionFilter;
  });

  const activeSchool = selectedSchoolId ? schools.find(s => s.id === selectedSchoolId) : null;
  const schoolHasNoRoutes = !!activeSchool && !isLoading && routes.length === 0;

  // Zoom to home address
  useEffect(() => {
    const prevCoords = previousHomeAddressRef.current?.coordinates;
    const currentCoords = homeAddress?.coordinates;
    const coordinatesChanged = prevCoords && currentCoords && 
      (prevCoords[0] !== currentCoords[0] || prevCoords[1] !== currentCoords[1]);
    const wasJustAdded = !previousHomeAddressRef.current && homeAddress;
    
    if (coordinatesChanged) {
      hasZoomedToAddressRef.current = false;
    }
    
    if ((wasJustAdded || coordinatesChanged) && map && homeAddress && !hasZoomedToAddressRef.current) {
      if (validateLngLat(homeAddress.coordinates)) {
        const position = toLeafletPosition(homeAddress.coordinates);
        map.setView(position, 16, { animate: true });
        hasZoomedToAddressRef.current = true;
        lastAddressZoomTimeRef.current = Date.now();
      }
    }
    previousHomeAddressRef.current = homeAddress;
    if (!homeAddress) hasZoomedToAddressRef.current = false;
  }, [homeAddress, map]);

  // Zoom to lookup address
  useEffect(() => {
    if (lookupAddress && map) {
      if (!validateLngLat(lookupAddress.coordinates)) return;
      const prevCoords = previousLookupAddressRef.current?.coordinates;
      const currentCoords = lookupAddress.coordinates;
      const isNewAddress = !prevCoords || prevCoords[0] !== currentCoords[0] || prevCoords[1] !== currentCoords[1];
      
      if (isNewAddress) hasZoomedToLookupAddressRef.current = false;
      if (isNewAddress && !hasZoomedToLookupAddressRef.current) {
        const position = toLeafletPosition(lookupAddress.coordinates);
        map.setView(position, 16, { animate: true });
        hasZoomedToLookupAddressRef.current = true;
        lastAddressZoomTimeRef.current = Date.now();
      }
      previousLookupAddressRef.current = lookupAddress;
    } else {
      hasZoomedToLookupAddressRef.current = false;
      previousLookupAddressRef.current = null;
    }
  }, [lookupAddress, map]);

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
    } catch (error) {
      console.error(`[MapView] ❌ Error fetching route for ${route.name}:`, error);
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
  // Only auto-fit if no stop is selected (to allow manual zooming)
  // Don't auto-fit if we just zoomed to an address (within last 2 seconds)
  useEffect(() => {
    // Don't fit bounds if we just zoomed to an address (give address zoom priority)
    const timeSinceAddressZoom = Date.now() - lastAddressZoomTimeRef.current;
    if (timeSinceAddressZoom < 2000) {
      return;
    }
    
    if (map && !selectedStop) {
      if (selectedRoutes.length > 0) {
        const allCoordinates: [number, number][] = [];

        selectedRoutes.forEach(route => {
          route.stops.forEach(stop => {
            if (stop.coordinates) {
              if (!validateLngLat(stop.coordinates)) {
                console.warn('[MapView] Invalid stop coordinates, skipping:', stop.coordinates);
                return;
              }
              // Convert [lng, lat] to [lat, lng] for Leaflet
              allCoordinates.push(toLeafletPosition(stop.coordinates));
            }
          });
        });

        // Don't include home address in bounds - let routes control the view
        if (allCoordinates.length > 0) {
          const bounds = L.latLngBounds(allCoordinates);
          map.fitBounds(bounds, { padding: [50, 50] });
        }
      } else if (activeSchool && activeSchool.coordinates && validateLngLat(activeSchool.coordinates)) {
        // If no routes but school is selected, zoom to school
        const position = toLeafletPosition(activeSchool.coordinates);
        map.setView(position, 15, { animate: true });
      }
    }
  }, [selectedRoutes, routes, selectedStop, activeSchool?.id, map]); // Added map to dependencies

  // Zoom to selected stop when it changes
  useEffect(() => {
    if (map && selectedStop && selectedStop.stop.coordinates) {
      if (!validateLngLat(selectedStop.stop.coordinates)) {
        console.error('[MapView] Invalid selected stop coordinates:', selectedStop.stop.coordinates);
        return;
      }
      const position = toLeafletPosition(selectedStop.stop.coordinates);
      map.setView(position, 18, { animate: true });
    }
    
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
  }, [selectedStop?.route.id, selectedStop?.stop.id, map]); // Added map to dependencies

  // Zoom to highlighted street bounds (only if feature is enabled)
  useEffect(() => {
    if (enableStreetHighlighting && map && highlightedStreet) {
      const bounds = L.latLngBounds(
        [highlightedStreet.bounds.south, highlightedStreet.bounds.west],
        [highlightedStreet.bounds.north, highlightedStreet.bounds.east]
      );
      map.fitBounds(bounds, { padding: [50, 50], animate: true });
    }
  }, [highlightedStreet, enableStreetHighlighting, map]); // Added map to dependencies

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
        map.fitBounds(bounds, { padding: [50, 50], animate: true });
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
  const isPanelOpen = !!selectedStop || showSchoolInfo || (viewMode === 'schools' && !!selectedSchoolId);
  const displaySchool = showSchoolInfo ? activeSchool : (viewMode === 'schools' ? schools.find(s => s.id === selectedSchoolId) : null);

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

      {/* Home address marker */}
      {homeAddress && (
        <Marker 
          position={[homeAddress.coordinates[1], homeAddress.coordinates[0]]} 
          icon={homeIcon}
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
            const position = toLeafletPosition(school.coordinates!);

            return (
              <Marker 
                key={`school-all-${school.id}`}
                position={position}
                icon={icon}
                eventHandlers={{
                  click: () => onSelectSchool?.(isSelected ? null : school.id)
                }}
                zIndexOffset={isSelected ? 1000 : 0}
              />
            );
          });
        } else {
          // Routes view - only show active school
          if (!activeSchool || !activeSchool.coordinates) return null;
          if (!validateLngLat(activeSchool.coordinates)) return null;
          
          const position = toLeafletPosition(activeSchool.coordinates);
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
                  clearSelectedStop();
                  setShowSchoolInfo(true);
                }
              }}
            />
          );
        }
      })()}

      {/* Route lines and stop dots */}
      {selectedRoutes.map((route) => {
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

        return (
          <React.Fragment key={route.id}>
            {/* Route polyline - follows streets when available */}
            {routeCoordinates.length > 1 && (
              <Polyline
                positions={routeCoordinates}
                color={route.color}
                weight={3}
                opacity={routeGeometry === null ? 0.4 : 0.8}
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
                // School stop: use school icon, no number
                stopNumber = 0; // For identification, but won't be displayed
                icon = createSchoolIcon(route.color, stop.time);
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
                  selectStop(route, stop, stopNumber);
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
            onClick={() => setSelectedSchool(null)}
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

      {/* Improved Stop/School info overlay using MapInfoPanel */}
      <MapInfoPanel 
        isOpen={isPanelOpen} 
        onClose={() => {
          clearSelectedStop();
          setShowSchoolInfo(false);
          if (viewMode === 'schools') onSelectSchool?.(null);
        }}
      >
        {selectedStop ? (
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
              clearSelectedStop();
            }}
            enableStreetPins={enableStreetPins}
            loadingStreetPins={loadingStreetPins}
            onDropStreetPins={handleDropStreetPins}
            editingMode={editingMode}
            undoHistoryCount={undoHistory.length}
            onUndo={handleUndo}
          />
        ) : isPanelOpen && displaySchool ? (
          <SchoolInfoTooltip 
            school={displaySchool} 
            showRoutesButton={viewMode === 'schools'}
            onClose={() => {
              setShowSchoolInfo(false);
              if (viewMode === 'schools') onSelectSchool?.(null);
            }}
            onViewRoutes={() => {
              setShowSchoolInfo(false);
              if (viewMode === 'schools') {
                setSelectedSchool(displaySchool.id);
                // Dispatch event to change tab
                window.dispatchEvent(new CustomEvent('change-tab', { detail: 'routes' }));
              }
            }}
          />
        ) : null}
      </MapInfoPanel>

      {/* Loading spinner animation */}
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

