import { useEffect, useRef, useState } from 'react';
import { MapContainer, Polyline, Marker, Popup, ZoomControl } from 'react-leaflet';
import L from 'leaflet';
import { useStore } from '../store/useStore';
import { fetchRouteForStops } from '../services/routing';
import { formatStreetName, extractStreetNames, expandAddressForGeocoding } from '../utils/formatAddress';
import { createHomeIcon, createDefaultMarkerIcon } from '../utils/fontAwesomeIcons';
import { createSchoolIcon, createNumberedIcon } from '../utils/markerIcons';
import { geocodeAddress } from '../services/api';
import { toLeafletPosition, validateLngLat, formatCoordinates } from '../utils/coordinates';
import { DarkModeTileLayer } from './DarkModeTileLayer';
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

export function MapView({ editingMode = false, enableStreetHighlighting = false, enableStreetPins = false }: MapViewProps) {
  const { routes, homeAddress, lookupAddress, selectedStop, clearSelectedStop, selectStop, selectedSchoolId, updateStopCoordinates, directionFilter } = useStore();
  const mapRef = useRef<L.Map | null>(null);
  const [routeGeometries, setRouteGeometries] = useState<RouteGeometry>({});
  const [undoHistory, setUndoHistory] = useState<UndoStep[]>([]);
  const routeRecalcTimeoutRef = useRef<{ [routeId: string]: ReturnType<typeof setTimeout> }>({});
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

  // Get selected routes, filtered by direction
  const selectedRoutes = routes.filter(route => {
    if (!route.isSelected) return false;
    if (directionFilter === 'Both') return true;
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
      mapRef.current.setView(position, 16, { animate: true });
      hasZoomedToAddressRef.current = true;
      lastAddressZoomTimeRef.current = Date.now();
    }
    
    // Update the ref to track previous value
    previousHomeAddressRef.current = homeAddress;
    
    // Reset zoom flag if address is cleared
    if (!homeAddress) {
      hasZoomedToAddressRef.current = false;
    }
  }, [homeAddress]);

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

    // Mark as loading
    setRouteGeometries(prev => ({ ...prev, [routeId]: null }));
    console.log(`[MapView] 🗺️  Recalculating route geometry for ${route.name} (${stopsWithCoords.length} stops)`);

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
        console.log(`[MapView] ✅ Route geometry updated for ${route.name}: ${routeCoordinates.length} points`);
        setRouteGeometries(prevState => ({ ...prevState, [routeId]: routeCoordinates }));
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

      console.log(`[MapView] 🗺️  Fetching route geometry for ${selectedRoutes.length} selected route(s)`);

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
    
    if (mapRef.current && selectedRoutes.length > 0 && !selectedStop) {
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
        mapRef.current.fitBounds(bounds, { padding: [50, 50] });
      }
    }
  }, [selectedRoutes, routes, selectedStop]); // Removed homeAddress from dependencies

  // Zoom to selected stop when it changes
  useEffect(() => {
    if (mapRef.current && selectedStop && selectedStop.stop.coordinates) {
      if (!validateLngLat(selectedStop.stop.coordinates)) {
        console.error('[MapView] Invalid selected stop coordinates:', selectedStop.stop.coordinates);
        return;
      }
      const position = toLeafletPosition(selectedStop.stop.coordinates);
      mapRef.current.setView(position, 18, { animate: true });
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
  }, [selectedStop?.route.id, selectedStop?.stop.id]);

  // Zoom to highlighted street bounds (only if feature is enabled)
  useEffect(() => {
    if (enableStreetHighlighting && mapRef.current && highlightedStreet) {
      const bounds = L.latLngBounds(
        [highlightedStreet.bounds.south, highlightedStreet.bounds.west],
        [highlightedStreet.bounds.north, highlightedStreet.bounds.east]
      );
      mapRef.current.fitBounds(bounds, { padding: [50, 50], animate: true });
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
        mapRef.current.fitBounds(bounds, { padding: [50, 50], animate: true });
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
                icon = createNumberedIcon(stopNumber, route.color, stop.time, isSelected, editingMode);
              }

              return (
                <Marker
                  key={stop.id}
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
          </div>
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

      {/* Stop info overlay at bottom */}
      {selectedStop && (
        <div
          style={{
            position: 'absolute',
            bottom: '1rem',
            right: '1rem',
            backgroundColor: 'var(--bg-primary)',
            padding: '1rem 1.5rem',
            borderRadius: '8px',
            boxShadow: '0 4px 12px var(--shadow-hover)',
            minWidth: '300px',
            maxWidth: '400px',
            zIndex: 1000,
            border: `2px solid ${selectedStop.route.color}`,
            transition: 'background-color 0.3s ease',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
            <div>
              <div style={{ fontWeight: 'bold', fontSize: '16px', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                <span style={{ color: 'var(--text-primary)' }}>{selectedStop.route.name}</span>
                {selectedStop.route.direction && (
                  <span style={{ 
                    fontSize: '12px', 
                    padding: '3px 10px',
                    borderRadius: '12px',
                    fontWeight: '500',
                    backgroundColor: selectedStop.route.direction === 'Morning' ? '#B3E5FC' : '#C8E6C9',
                    color: selectedStop.route.direction === 'Morning' ? '#01579B' : '#1B5E20',
                  }}>
                    {selectedStop.route.direction}
                  </span>
                )}
              </div>
              {selectedStop.stopNumber > 0 && (
                <div style={{ fontSize: '14px', color: 'var(--text-tertiary)', marginBottom: '0.25rem' }}>
                  Stop {selectedStop.stopNumber}
                </div>
              )}
              {selectedStop.stop.isSchoolStop && (
                <div style={{ fontSize: '14px', color: 'var(--text-tertiary)', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <span>🏫</span> School Loading Zone
                </div>
              )}
              <div style={{ fontSize: '15px', fontWeight: '500', marginBottom: '0.25rem', color: 'var(--text-primary)' }}>
                {selectedStop.stop.isSchoolStop && selectedStop.stop.schoolName ? (
                  selectedStop.stop.schoolName
                ) : enableStreetHighlighting ? (
                  <div>
                    {(() => {
                      const address = selectedStop.stop.address;
                      const streets = extractStreetNames(address);
                      
                      if (streets.length === 1) {
                        // Single street - make it clickable
                        const streetName = streets[0];
                        const isHighlighted = highlightedStreet?.name === streetName;
                        const isLoading = loadingStreet === streetName;
                        
                        return (
                          <span
                            onClick={() => !isLoading && handleStreetClick(streetName)}
                            style={{
                              cursor: isLoading ? 'not-allowed' : 'pointer',
                              textDecoration: isLoading ? 'none' : 'underline',
                              color: isHighlighted ? '#FFD700' : isLoading ? 'var(--text-tertiary)' : 'var(--text-primary)',
                              fontWeight: isHighlighted ? 'bold' : 'normal',
                              opacity: isLoading ? 0.6 : 1,
                              transition: 'all 0.2s ease',
                            }}
                            onMouseEnter={(e) => {
                              if (!isLoading) {
                                e.currentTarget.style.color = '#4ECDC4';
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (!isLoading) {
                                e.currentTarget.style.color = isHighlighted ? '#FFD700' : 'var(--text-primary)';
                              }
                            }}
                            title={isLoading ? 'Loading street geometry...' : 'Click to highlight street on map'}
                          >
                            {formatStreetName(streetName)}
                            {isLoading && (
                              <span style={{ marginLeft: '0.5rem', display: 'inline-block' }}>
                                <span style={{
                                  display: 'inline-block',
                                  width: '12px',
                                  height: '12px',
                                  border: '2px solid var(--text-tertiary)',
                                  borderTopColor: 'transparent',
                                  borderRadius: '50%',
                                  animation: 'spin 0.8s linear infinite',
                                }} />
                              </span>
                            )}
                          </span>
                        );
                      } else if (streets.length > 1) {
                        // Multiple streets - make each clickable
                        return (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            {streets.map((streetName, index) => {
                              const isHighlighted = highlightedStreet?.name === streetName;
                              const isLoading = loadingStreet === streetName;
                              
                              return (
                                <div key={index} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                  {index > 0 && (
                                    <span style={{ color: 'var(--text-tertiary)', fontSize: '14px' }}>&</span>
                                  )}
                                  {isLoading ? (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-tertiary)' }}>
                                      <span style={{
                                        display: 'inline-block',
                                        width: '12px',
                                        height: '12px',
                                        border: '2px solid var(--text-tertiary)',
                                        borderTopColor: 'transparent',
                                        borderRadius: '50%',
                                        animation: 'spin 0.8s linear infinite',
                                      }} />
                                      <span style={{ fontSize: '14px' }}>Finding street geometry...</span>
                                    </div>
                                  ) : (
                                    <span
                                      onClick={() => handleStreetClick(streetName)}
                                      style={{
                                        cursor: 'pointer',
                                        textDecoration: 'underline',
                                        color: isHighlighted ? '#FFD700' : 'var(--text-primary)',
                                        fontWeight: isHighlighted ? 'bold' : 'normal',
                                        transition: 'all 0.2s ease',
                                      }}
                                      onMouseEnter={(e) => {
                                        e.currentTarget.style.color = '#4ECDC4';
                                      }}
                                      onMouseLeave={(e) => {
                                        e.currentTarget.style.color = isHighlighted ? '#FFD700' : 'var(--text-primary)';
                                      }}
                                      title="Click to highlight street on map"
                                    >
                                      {formatStreetName(streetName)}
                                    </span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        );
                      } else {
                        // Fallback: just show formatted address
                        return formatStreetName(address);
                      }
                    })()}
                  </div>
                ) : (
                  formatStreetName(selectedStop.stop.address)
                )}
              </div>
              {enableStreetHighlighting && streetError && (
                <div style={{ 
                  fontSize: '12px', 
                  color: '#f44336', 
                  marginTop: '0.25rem',
                  padding: '0.5rem',
                  backgroundColor: 'rgba(244, 67, 54, 0.1)',
                  borderRadius: '4px',
                }}>
                  ⚠️ {streetError}
                </div>
              )}
              {selectedStop.stop.time && (
                <div style={{ fontSize: '14px', color: 'var(--text-tertiary)' }}>
                  {selectedStop.stop.time}
                </div>
              )}
              {/* Drop pins button for intersections (admin only) */}
              {enableStreetPins && !selectedStop.stop.isSchoolStop && extractStreetNames(selectedStop.stop.address).length > 0 && (
                <button
                  onClick={handleDropStreetPins}
                  disabled={loadingStreetPins}
                  style={{
                    marginTop: '0.75rem',
                    width: '100%',
                    background: loadingStreetPins ? 'var(--text-tertiary)' : '#4ECDC4',
                    border: 'none',
                    fontSize: '14px',
                    cursor: loadingStreetPins ? 'not-allowed' : 'pointer',
                    color: 'white',
                    padding: '0.5rem 1rem',
                    borderRadius: '4px',
                    fontWeight: '500',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem',
                    opacity: loadingStreetPins ? 0.6 : 1,
                    transition: 'background-color 0.2s ease, opacity 0.2s ease',
                  }}
                  onMouseEnter={(e) => {
                    if (!loadingStreetPins) {
                      e.currentTarget.style.backgroundColor = '#3db8a8';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!loadingStreetPins) {
                      e.currentTarget.style.backgroundColor = '#4ECDC4';
                    }
                  }}
                  title="Drop pins on each street in this intersection"
                >
                  {loadingStreetPins ? (
                    <>
                      <span style={{
                        display: 'inline-block',
                        width: '14px',
                        height: '14px',
                        border: '2px solid white',
                        borderTopColor: 'transparent',
                        borderRadius: '50%',
                        animation: 'spin 0.8s linear infinite',
                      }} />
                      <span>Dropping pins...</span>
                    </>
                  ) : (
                    <>
                      <span>📍</span>
                      <span>Drop Pins on Streets</span>
                    </>
                  )}
                </button>
              )}
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              {editingMode && selectedStop && undoHistory.length > 0 && undoHistory[0]?.routeId === selectedStop.route.id && undoHistory[0]?.stopId === selectedStop.stop.id && (
                <button
                  onClick={async () => {
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
                  }}
                  style={{
                    background: '#4ECDC4',
                    border: 'none',
                    fontSize: '14px',
                    cursor: 'pointer',
                    color: 'white',
                    padding: '0.5rem 1rem',
                    borderRadius: '4px',
                    fontWeight: '500',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.25rem',
                  }}
                  title={`Undo (${undoHistory.length} step${undoHistory.length !== 1 ? 's' : ''} available)`}
                >
                  <span>↶</span> Undo
                </button>
              )}
              <button
                onClick={() => clearSelectedStop()}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '20px',
                  cursor: 'pointer',
                  color: 'var(--text-tertiary)',
                  padding: '0',
                  lineHeight: '1',
                  transition: 'color 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = 'var(--text-primary)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = 'var(--text-tertiary)';
                }}
                title="Close"
              >
                ×
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Loading spinner animation */}
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

