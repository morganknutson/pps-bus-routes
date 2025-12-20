import { useEffect, useRef, useState } from 'react';
import { MapContainer, Polyline, Marker, Popup, Tooltip, ZoomControl, useMap } from 'react-leaflet';
import L from 'leaflet';
import { useStore } from '../store/useStore';
import { fetchRouteForStops } from '../services/routing';
import { formatStreetName, extractStreetNames, expandAddressForGeocoding } from '../utils/formatAddress';
import { createHomeIcon, createDefaultMarkerIcon } from '../utils/fontAwesomeIcons';
import { createSchoolIcon, createNumberedIcon, getNumberedIconDimensions } from '../utils/markerIcons';
import { getSchoolTypes, getSchoolColor, createSchoolIcon as createSchoolIconBase } from '../utils/schoolUtils';
import { formatDate } from '../utils/dateUtils';
import { handleMapLinkClick } from '../utils/mapLinks';
import { geocodeAddress } from '../services/api';
import { toLeafletPosition, validateLngLat, formatCoordinates } from '../utils/coordinates';
import { DarkModeTileLayer } from './DarkModeTileLayer';
import { useIsMobile } from '../hooks/useMediaQuery';
import { Route, Stop } from '../types';
import { SchoolInfoTooltip } from './SchoolInfoTooltip';
import { StopInfoTooltip } from './StopInfoTooltip';
import 'leaflet/dist/leaflet.css';

const homeIcon = createHomeIcon();
const defaultMarkerIcon = createDefaultMarkerIcon();

interface RouteGeometry {
  [routeId: string]: [number, number][] | null; // null means still loading
}

interface MapViewProps {
  editingMode?: boolean;
  enableStreetHighlighting?: boolean;
  enableStreetPins?: boolean; // Enable the drop pins feature (admin only)
  onSchoolStopClick?: (schoolId: string) => void; // Callback when a school stop marker is clicked
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

export function MapView({ editingMode = false, enableStreetHighlighting = false, enableStreetPins = false, onSchoolStopClick }: MapViewProps) {
  const { routes, schools, homeAddress, lookupAddress, selectedStop, clearSelectedStop, selectStop, selectedSchoolId, setSelectedSchool, updateStopCoordinates, directionFilter, shouldZoomToHomeAddress, clearZoomToHomeAddress, isLoading } = useStore();
  const isMobile = useIsMobile();
  const mapRef = useRef<L.Map | null>(null);
  const [routeGeometries, setRouteGeometries] = useState<RouteGeometry>({});
  const [undoHistory, setUndoHistory] = useState<UndoStep[]>([]);
  const routeRecalcTimeoutRef = useRef<{ [routeId: string]: ReturnType<typeof setTimeout> }>({});
  const previousHomeAddressRef = useRef<typeof homeAddress>(undefined);
  const hasZoomedToAddressRef = useRef<boolean>(false);
  const previousLookupAddressRef = useRef<{ address: string; coordinates: [number, number] } | null>(null);
  const hasZoomedToLookupAddressRef = useRef<boolean>(false);
  const lastAddressZoomTimeRef = useRef<number>(0);
  const hasZoomedToStopRef = useRef<boolean>(false);
  const [highlightedStreet, setHighlightedStreet] = useState<HighlightedStreet | null>(null);
  const [loadingStreet, setLoadingStreet] = useState<string | null>(null);
  const [streetError, setStreetError] = useState<string | null>(null);
  const [streetMarkers, setStreetMarkers] = useState<StreetMarker[]>([]);
  const [loadingStreetPins, setLoadingStreetPins] = useState<boolean>(false);
  const [showSchoolInfoPopup, setShowSchoolInfoPopup] = useState<boolean>(false);

  // Reset school info popup when school changes
  useEffect(() => {
    setShowSchoolInfoPopup(false);
  }, [selectedSchoolId]);

  // Get selected routes, filtered by direction
  const selectedRoutes = routes.filter(route => {
    if (!route.isSelected) return false;
    if (directionFilter === 'Both') return true;
    // If route has no direction (null), show it for any filter
    if (!route.direction) return true;
    return route.direction === directionFilter;
  });

  // Zoom to home address only when it's first added or coordinates change
  useEffect(() => {
    // Check if address was just added (changed from undefined to a value)
    // or if coordinates actually changed (not just object reference)
    const prevCoords = previousHomeAddressRef.current?.coordinates;
    const currentCoords = homeAddress?.coordinates;
    const coordinatesChanged = prevCoords && currentCoords && 
      (prevCoords[0] !== currentCoords[0] || prevCoords[1] !== currentCoords[1]);
    const wasJustAdded = !previousHomeAddressRef.current && homeAddress;
    
    // If coordinates changed, reset the zoom flag so we can zoom to the new address
    if (coordinatesChanged) {
      hasZoomedToAddressRef.current = false;
    }
    
    if ((wasJustAdded || coordinatesChanged) && mapRef.current && homeAddress && !hasZoomedToAddressRef.current) {
      if (!validateLngLat(homeAddress.coordinates)) {
        console.error('[MapView] Invalid home address coordinates:', homeAddress.coordinates);
        return;
      }
      const position = toLeafletPosition(homeAddress.coordinates);
      mapRef.current.setView(position, 16, { 
        animate: true,
        duration: 0.6 // Snappy zoom
      });
      hasZoomedToAddressRef.current = true;
      lastAddressZoomTimeRef.current = Date.now();
    }
    
    // Update the ref to track previous value
    previousHomeAddressRef.current = homeAddress;
    
    // Reset zoom flag if address is cleared
    if (!homeAddress) {
      hasZoomedToAddressRef.current = false;
    }
  }, [homeAddress, selectedStop]);

  // Zoom to lookup address only when it actually changes (different coordinates)
  useEffect(() => {
    if (lookupAddress && mapRef.current) {
      if (!validateLngLat(lookupAddress.coordinates)) {
        console.error('[MapView] Invalid lookup address coordinates:', lookupAddress.coordinates);
        return;
      }
      
      // Check if coordinates actually changed (compare by value, not object reference)
      const prevCoords = previousLookupAddressRef.current?.coordinates;
      const currentCoords = lookupAddress.coordinates;
      const isNewAddress = !prevCoords || 
        prevCoords[0] !== currentCoords[0] || 
        prevCoords[1] !== currentCoords[1];
      
      // If it's a new address, reset the zoom flag so we can zoom to it
      if (isNewAddress) {
        hasZoomedToLookupAddressRef.current = false;
      }
      
      // Only zoom if it's a new address or we haven't zoomed to this address yet
      if (isNewAddress && !hasZoomedToLookupAddressRef.current) {
        const position = toLeafletPosition(lookupAddress.coordinates);
        mapRef.current.setView(position, 16, { animate: true });
        hasZoomedToLookupAddressRef.current = true;
        lastAddressZoomTimeRef.current = Date.now();
      }
      
      previousLookupAddressRef.current = lookupAddress;
    } else {
      // Reset zoom flag when lookupAddress is cleared
      hasZoomedToLookupAddressRef.current = false;
      previousLookupAddressRef.current = null;
    }
  }, [lookupAddress]);

  // Zoom to home address when triggered from address bar - REMOVED, now handled in FitMapBounds

  // Component to zoom to selected stop or school
  // This component uses useMap() to access the map instance inside MapContainer
  function FitMapBounds() {
    const map = useMap();
    const prevStopIdRef = useRef<string | null>(null);
    const prevSchoolIdRef = useRef<string | null>(null);
    const hasZoomedRef = useRef<boolean>(false);
    const mapReadyRef = useRef<boolean>(false);
    const { schools, selectedSchoolId, selectedStop, homeAddress, shouldZoomToHomeAddress, clearZoomToHomeAddress } = useStore();
    
    // Mark map as ready when it's initialized
    useEffect(() => {
      if (map && !mapReadyRef.current) {
        map.whenReady(() => {
          mapReadyRef.current = true;
        });
      }
    }, [map]);
    
    useEffect(() => {
      if (!map || !mapReadyRef.current) {
        return;
      }

      // CASE 0: Explicit request to zoom to home (e.g. from address bar or on load)
      // This has high priority and can combine with selected routes
      if (shouldZoomToHomeAddress && homeAddress && validateLngLat(homeAddress.coordinates)) {
        // If routes are still loading, wait for them to finish before zooming 
        // so we can correctly fit both home and routes
        if (isLoading && selectedRoutes.length === 0) {
          console.log('[FitMapBounds] ⏳ Routes are loading, waiting to zoom...');
          return;
        }

        const homePosition = toLeafletPosition(homeAddress.coordinates);
        const allCoords: [number, number][] = [homePosition];
        
        if (selectedRoutes.length > 0) {
          selectedRoutes.forEach(route => {
            route.stops.forEach(stop => {
              if (stop.coordinates && validateLngLat(stop.coordinates)) {
                allCoords.push(toLeafletPosition(stop.coordinates));
              }
            });
          });
        }

        const timer = setTimeout(() => {
          try {
            if (allCoords.length > 1) {
              // Zoom to fit both home and routes
              const bounds = L.latLngBounds(allCoords);
              map.fitBounds(bounds, { 
                padding: [100, 100], 
                animate: true,
                duration: 0.6
              });
              console.log('[FitMapBounds] 🏠🗺️ Zoomed to show home and selected routes');
            } else {
              // Just zoom to home if no routes
              map.setView(homePosition, 16, { 
                animate: true,
                duration: 0.6
              });
              console.log('[FitMapBounds] 🏠 Zoomed to home address only');
            }
            
            if (clearZoomToHomeAddress) {
              clearZoomToHomeAddress();
            }
          } catch (error) {
            console.error('[FitMapBounds] Error zooming to home:', error);
            if (clearZoomToHomeAddress) {
              clearZoomToHomeAddress();
            }
          }
        }, 150);

        return () => clearTimeout(timer);
      }
      
      // CASE 1: Stop is selected - priority zoom
      if (selectedStop && selectedStop.stop.coordinates) {
        const currentStopId = `${selectedStop.route.id}-${selectedStop.stop.id}`;
        const isNewStop = prevStopIdRef.current !== currentStopId;
        
        if (!isNewStop && hasZoomedRef.current) {
          return;
        }

        if (!validateLngLat(selectedStop.stop.coordinates)) {
          return;
        }

        const stopPosition = toLeafletPosition(selectedStop.stop.coordinates);
        
        if (isNewStop) {
          hasZoomedRef.current = false;
        }
        
        const timer = setTimeout(() => {
          try {
            // Calculate a target center that is shifted so the pin is 100px above the center
            const zoom = 16;
            
            // Get icon dimensions to account for horizontal offset (full width of the pin)
            const dimensions = getNumberedIconDimensions(selectedStop.stopNumber, selectedStop.stop.time, true);
            
            const targetPoint = map.project(stopPosition, zoom).add([dimensions.centerShiftX, 100]);
            const targetLatLng = map.unproject(targetPoint, zoom);

            map.setView(targetLatLng, zoom, { 
              animate: true,
              duration: 0.6
            });

            hasZoomedRef.current = true;
            prevStopIdRef.current = currentStopId;
            prevSchoolIdRef.current = selectedSchoolId; // Update this too
          } catch (error) {
            console.error('[MapView] Error zooming to stop:', error);
          }
        }, 150);
        
        return () => clearTimeout(timer);
      } 
      
      // CASE 2: No stop selected, but routes are selected - fit to routes
      if (!selectedStop && selectedRoutes.length > 0) {
        const allCoordinates: [number, number][] = [];
        selectedRoutes.forEach(route => {
          route.stops.forEach(stop => {
            if (stop.coordinates && validateLngLat(stop.coordinates)) {
              allCoordinates.push(toLeafletPosition(stop.coordinates));
            }
          });
        });

        if (allCoordinates.length > 0) {
          const bounds = L.latLngBounds(allCoordinates);
          const hasSelectedBefore = prevStopIdRef.current !== null || prevSchoolIdRef.current !== null;
          
          // Use a small delay for zoom out to ensure smooth transition
          const timer = setTimeout(() => {
            try {
          map.fitBounds(bounds, { 
            padding: [50, 50], 
            animate: hasSelectedBefore,
            duration: 0.6
          });
              hasZoomedRef.current = false;
            } catch (error) {
              console.error('[FitMapBounds] Error fitting bounds:', error);
            }
          }, 100);
          
          prevStopIdRef.current = null;
          prevSchoolIdRef.current = selectedSchoolId;
          return () => clearTimeout(timer);
        }
        return;
      }

      // CASE 3: No stop or routes selected, but school is selected - zoom to school
      if (!selectedStop && selectedSchoolId) {
        const school = schools.find(s => s.id === selectedSchoolId);
        if (school && school.coordinates) {
          const isNewSchool = prevSchoolIdRef.current !== selectedSchoolId;
          
          if (!isNewSchool && hasZoomedRef.current) {
            return;
          }

          const schoolPosition = toLeafletPosition(school.coordinates);
          
          if (isNewSchool) {
            hasZoomedRef.current = false;
          }
          
          const timer = setTimeout(() => {
            try {
              // Calculate a target center that is shifted so the pin is 100px above the center
              const zoom = 16;
              const targetPoint = map.project(schoolPosition, zoom).add([0, 100]);
              const targetLatLng = map.unproject(targetPoint, zoom);

              map.setView(targetLatLng, zoom, { 
                animate: true,
                duration: 0.6
              });

              hasZoomedRef.current = true;
              prevSchoolIdRef.current = selectedSchoolId;
              prevStopIdRef.current = null; // Clear stop ref
            } catch (error) {
              console.error('[MapView] Error zooming to school:', error);
            }
          }, 150);
          
          return () => clearTimeout(timer);
        }
      }

      // CASE 4: Nothing selected (or only school) - fit to school if possible, or reset
      if (!selectedStop && selectedRoutes.length === 0) {
        if (selectedSchoolId) {
          const school = schools.find(s => s.id === selectedSchoolId);
          if (school && school.coordinates && (prevStopIdRef.current !== null)) {
            const schoolPosition = toLeafletPosition(school.coordinates);
            const timer = setTimeout(() => {
              try {
                // Same logic as Case 3
                const zoom = 16;
                const targetPoint = map.project(schoolPosition, zoom).add([0, 100]);
                const targetLatLng = map.unproject(targetPoint, zoom);
                map.setView(targetLatLng, zoom, { animate: true, duration: 0.6 });
                hasZoomedRef.current = true;
              } catch (error) {
                console.error('[FitMapBounds] Error resetting to school:', error);
              }
            }, 100);
            prevStopIdRef.current = null;
            return () => clearTimeout(timer);
          }
        }
        
        // Final fallback - if nothing is selected and we were previously zoomed in
        if (prevStopIdRef.current !== null || prevSchoolIdRef.current !== null) {
          prevStopIdRef.current = null;
          prevSchoolIdRef.current = null;
          hasZoomedRef.current = false;
        }
      }
    }, [map, selectedStop?.route.id, selectedStop?.stop.id, selectedSchoolId, schools.length, selectedRoutes.length]);
    
    return null;
  }

  /**
   * Snap route geometry endpoints to school stop coordinates
   * This ensures the route polyline ends exactly at the school pin location
   * @param route The route object
   * @param geometry Route geometry in [lat, lng][] format (Leaflet format)
   * @returns Geometry with endpoints snapped to school stop coordinates
   */
  const snapGeometryToSchoolStop = (route: Route, geometry: [number, number][]): [number, number][] => {
    if (!geometry || geometry.length === 0) {
      return geometry;
    }

    const stopsWithCoords = route.stops.filter(stop => stop.coordinates && !stop.skipGeocoding);
    if (stopsWithCoords.length === 0) {
      return geometry;
    }

    const snappedGeometry = [...geometry];

    // Check if first stop is a school stop (Afternoon routes)
    const firstStop = stopsWithCoords[0];
    if (firstStop.isSchoolStop && firstStop.coordinates && validateLngLat(firstStop.coordinates)) {
      const schoolStopPosition = toLeafletPosition(firstStop.coordinates);
      // Snap first point of geometry to school stop
      snappedGeometry[0] = schoolStopPosition;
      console.log(`[MapView] 📍 Snapped route start to school stop for ${route.name} (Afternoon route)`);
    }

    // Check if last stop is a school stop (Morning routes)
    const lastStop = stopsWithCoords[stopsWithCoords.length - 1];
    if (lastStop.isSchoolStop && lastStop.coordinates && validateLngLat(lastStop.coordinates)) {
      const schoolStopPosition = toLeafletPosition(lastStop.coordinates);
      // Snap last point of geometry to school stop
      snappedGeometry[snappedGeometry.length - 1] = schoolStopPosition;
      console.log(`[MapView] 📍 Snapped route end to school stop for ${route.name} (Morning route)`);
    }

    return snappedGeometry;
  };

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
      // Snap geometry endpoints to school stop coordinates
      const snappedGeometry = snapGeometryToSchoolStop(route, route.geometry);
      setRouteGeometries(prevState => ({ ...prevState, [routeId]: snappedGeometry }));
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
        // Snap geometry endpoints to school stop coordinates
        const snappedGeometry = snapGeometryToSchoolStop(route, routeCoordinates);
        setRouteGeometries(prevState => ({ ...prevState, [routeId]: snappedGeometry }));
        
        // Save geometry to backend for future use (save snapped version)
        try {
          const response = await fetch(`/api/data/routes/${routeId}/geometry`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              geometry: snappedGeometry,
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
      // Snap geometry endpoints to school stop coordinates (even for fallback)
      const snappedFallback = snapGeometryToSchoolStop(route, fallbackCoordinates);
      setRouteGeometries(prevState => ({ ...prevState, [routeId]: snappedFallback }));
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
            // Snap geometry endpoints to school stop coordinates
            const snappedGeometry = snapGeometryToSchoolStop(route, route.geometry);
            return { ...prev, [route.id]: snappedGeometry };
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

  // Handle stop selection changes (clear history, highlighted streets, etc.)
  // Note: Zoom to stop is handled by FitHomeAndStopBounds component
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

  // Zoom to highlighted street bounds (only if feature is enabled)
  useEffect(() => {
    if (enableStreetHighlighting && mapRef.current && highlightedStreet) {
      const bounds = L.latLngBounds(
        [highlightedStreet.bounds.south, highlightedStreet.bounds.west],
        [highlightedStreet.bounds.north, highlightedStreet.bounds.east]
      );
      mapRef.current.fitBounds(bounds, { 
        padding: [50, 50], 
        animate: true,
        duration: 0.6
      });
    }
  }, [highlightedStreet, enableStreetHighlighting]);

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
      if (newMarkers.length > 0 && mapRef.current) {
        const bounds = L.latLngBounds(
          newMarkers.map(marker => {
            if (!validateLngLat(marker.coordinates)) {
              console.error('[MapView] Invalid marker coordinates:', marker.coordinates);
              throw new Error(`Invalid coordinates for marker ${marker.streetName}`);
            }
            return toLeafletPosition(marker.coordinates);
          })
        );
        mapRef.current.fitBounds(bounds, { 
        padding: [50, 50], 
        animate: true,
        duration: 0.6
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

  const handleUndo = async () => {
    const lastStep = undoHistory[0];
    if (!lastStep || !selectedStop) return;

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

  return (
    <div style={{ position: 'relative', height: '100%', width: '100%' }}>
      <MapContainer
        center={defaultCenter}
        zoom={12}
        style={{ height: '100%', width: '100%' }}
        ref={mapRef}
        zoomControl={false}
      >
      <DarkModeTileLayer />
      <ZoomControl position="bottomleft" />
      <FitMapBounds />

      {/* Standalone School Marker (handles school info and "no routes" guidance) */}
      {selectedSchoolId && routes.length > 0 && !isLoading && (() => {
        const school = schools.find(s => s.id === selectedSchoolId);
        if (!school || !school.coordinates || !validateLngLat(school.coordinates)) return null;
        
        const schoolTypes = school.schoolTypes || getSchoolTypes(school.name);
        const schoolColor = getSchoolColor(schoolTypes);
        const icon = createSchoolIconBase(schoolColor);
        const position = toLeafletPosition(school.coordinates);
        
        // Determine what to show in the tooltip
        const showNoRoutesMessage = !selectedStop && selectedRoutes.length === 0;
        
        return (
          <Marker 
            position={position} 
            icon={icon}
            eventHandlers={{
              click: (e) => {
                const isOpening = !showSchoolInfoPopup;
                setShowSchoolInfoPopup(isOpening);
                
                if (isOpening && e.target && e.target._map) {
                  const map = e.target._map;
                  const latlng = e.target.getLatLng();
                  const zoom = 16;
                  
                  // Calculate a target center that is shifted so the pin is 100px above the center
                  const targetPoint = map.project(latlng, zoom).add([0, 100]);
                  const targetLatLng = map.unproject(targetPoint, zoom);
                  
                  map.setView(targetLatLng, zoom, { 
                    animate: true,
                    duration: 0.6
                  });
                }
              }
            }}
            zIndexOffset={1000}
          >
            {(showNoRoutesMessage || showSchoolInfoPopup) && (
              <Tooltip 
                permanent 
                direction="bottom" 
                offset={[0, 30]}
                className="no-routes-tooltip"
                opacity={1}
              >
              <SchoolInfoTooltip 
                school={school} 
                onClose={() => setShowSchoolInfoPopup(false)}
                message={showSchoolInfoPopup ? undefined : `Select a route to view stops for ${school.name}`}
              />
              </Tooltip>
            )}
          </Marker>
        );
      })()}

      {/* Home address marker */}
      {homeAddress && (
        <Marker 
          position={[homeAddress.coordinates[1], homeAddress.coordinates[0]]} 
          icon={homeIcon}
          eventHandlers={{
            click: (e) => {
              const marker = e.target;
              const map = marker._map;
              if (map) {
                map.setView(marker.getLatLng(), 16, { 
                  animate: true,
                  duration: 0.6
                });
              }
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
          >
            <Popup>{lookupAddress.address}</Popup>
          </Marker>
        );
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
          <div key={route.id}>
            {/* Route polyline - follows streets when available */}
            {routeCoordinates.length > 1 && (
              <Polyline
                positions={routeCoordinates}
                color={route.color}
                weight={3}
                opacity={routeGeometry === null ? 0.4 : 0.8}
              />
            )}
          </div>
        );
      })}

      {/* Stop markers with numbers - rendered separately to avoid duplication across routes */}
      {(() => {
        // Group all stops from all selected routes
        // We want to show a stop only once if it's the same physical location and time
        const allStops: { stop: Stop; route: Route; stopNumber: number }[] = [];
        const seenStops = new Set<string>();

        selectedRoutes.forEach(route => {
          const stopsWithCoords = route.stops.filter(stop => stop.coordinates && !stop.skipGeocoding);
          
          stopsWithCoords.forEach((stop) => {
            // Skip school stops - handled by standalone school marker
            if (stop.isSchoolStop) return;

            // Create a unique key for this stop location + time + route name
            // We include route name because if the user selects TWO different routes (e.g. 100 and 101) 
            // that happen to share a stop, we might want to see both? 
            // But usually for PPS, duplicates are Morning/Afternoon versions of the same route.
            const stopKey = `${stop.coordinates![0]},${stop.coordinates![1]}-${stop.time}-${route.name}`;
            
            if (!seenStops.has(stopKey)) {
              seenStops.add(stopKey);
              
              // Calculate stop number
              const currentIndexInAllStops = route.stops.filter(s => s.coordinates && !s.skipGeocoding).findIndex(s => s.id === stop.id);
              let regularStopCount = 0;
              for (let i = 0; i < currentIndexInAllStops; i++) {
                const s = route.stops.filter(s => s.coordinates && !s.skipGeocoding)[i];
                if (!s.isSchoolStop && !s.skipGeocoding) {
                  regularStopCount++;
                }
              }
              const stopNumber = regularStopCount + 1;
              
              allStops.push({ stop, route, stopNumber });
            }
          });
        });

        return allStops.map(({ stop, route, stopNumber }) => {
          if (!validateLngLat(stop.coordinates)) return null;
          
          const position = toLeafletPosition(stop.coordinates!);
          const isSelected = selectedStop?.stop.id === stop.id && selectedStop?.route.id === route.id;
          
          const uniqueMarkerId = `${route.id}-${stop.id}`;
          const icon = createNumberedIcon(stopNumber, route.color, stop.time, isSelected, editingMode, uniqueMarkerId);

          return (
            <Marker
              key={`${route.id}-${stop.id}-${route.color}`}
              position={position}
              icon={icon}
              draggable={editingMode}
              zIndexOffset={isSelected ? 1000 : 0}
              eventHandlers={{
                click: () => selectStop(route, stop, stopNumber),
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
                    
                    setUndoHistory(prev => [{ routeId: route.id, stopId: stop.id, coordinates: oldCoords }, ...prev].slice(0, 5));
                    updateStopCoordinates(route.id, stop.id, newCoords);
                    
                    try {
                      const response = await fetch(`/api/data/routes/${route.id}/stops/${stop.id}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ coordinates: newCoords, schoolId: selectedSchoolId }),
                      });

                      if (!response.ok) throw new Error('Failed to save');

                      if (routeRecalcTimeoutRef.current[route.id]) clearTimeout(routeRecalcTimeoutRef.current[route.id]);
                      routeRecalcTimeoutRef.current[route.id] = setTimeout(() => recalculateRouteGeometry(route.id), 1500);
                    } catch (error) {
                      marker.setLatLng(position);
                      setUndoHistory(prev => prev.slice(1));
                      alert('Failed to save coordinates.');
                    }
                  },
                } : {}),
              }}
            >
              {isSelected && (() => {
                const dims = getNumberedIconDimensions(stopNumber, stop.time, true);
                return (
                  <Tooltip 
                    permanent 
                    direction="bottom" 
                    offset={[dims.centerShiftX, dims.bottomGapY]}
                    className="stop-info-tooltip"
                    opacity={1}
                  >
                    <StopInfoTooltip 
                      route={route}
                      stop={stop}
                      stopNumber={stopNumber}
                      onClose={clearSelectedStop}
                      enableStreetHighlighting={enableStreetHighlighting}
                      highlightedStreetName={highlightedStreet?.name}
                      loadingStreet={loadingStreet || undefined}
                      streetError={streetError || undefined}
                      onStreetClick={handleStreetClick}
                      enableStreetPins={enableStreetPins}
                      loadingStreetPins={loadingStreetPins}
                      onDropStreetPins={handleDropStreetPins}
                      editingMode={editingMode}
                      undoHistoryCount={undoHistory.filter(step => step.routeId === route.id && step.stopId === stop.id).length}
                      onUndo={handleUndo}
                    />
                  </Tooltip>
                );
              })()}
            </Marker>
          );
        });
      })()}

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
      
      {/* Loading spinner animation */}
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @keyframes slideUp {
          from {
            transform: translateY(100%);
          }
          to {
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}

