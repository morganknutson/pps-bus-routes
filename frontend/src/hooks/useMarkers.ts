import { useEffect, useRef, useMemo } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';

/**
 * Generic marker data interface
 */
export interface MarkerData {
  id: string;
  position: [number, number]; // [lat, lng]
  icon: L.Icon | L.DivIcon;
  onClick?: () => void;
  popup?: L.Content;
  tooltip?: L.Content;
  [key: string]: any; // Allow additional properties
}

/**
 * Options for useMarkers hook
 */
export interface UseMarkersOptions {
  /** Layer group to add markers to (optional, defaults to creating one) */
  layerGroup?: L.LayerGroup;
  /** Debug logging */
  debug?: boolean;
  /** Custom comparison function for marker data (optional) */
  compareMarkers?: (a: MarkerData, b: MarkerData) => boolean;
}

/**
 * Reusable hook for managing Leaflet markers manually.
 * This ensures markers are properly added/removed when the array changes,
 * which is more reliable than relying on React Leaflet's automatic management.
 * 
 * @param markers - Array of marker data to display
 * @param options - Optional configuration
 * @returns void
 * 
 * @example
 * ```tsx
 * const markers: MarkerData[] = schools.map(school => ({
 *   id: school.id,
 *   position: [school.coordinates[1], school.coordinates[0]],
 *   icon: createSchoolIcon(school.color),
 *   onClick: () => setSelectedSchool(school),
 * }));
 * 
 * useMarkers(markers);
 * ```
 */
/**
 * Default comparison function for markers
 */
function defaultCompareMarkers(a: MarkerData, b: MarkerData): boolean {
  if (a.id !== b.id) return false;
  if (a.position[0] !== b.position[0] || a.position[1] !== b.position[1]) return false;
  if (a.icon !== b.icon) return false;
  return true;
}

/**
 * Create a stable key from marker data for comparison
 */
function getMarkerKey(marker: MarkerData): string {
  return `${marker.id}-${marker.position[0]}-${marker.position[1]}`;
}

export function useMarkers(
  markers: MarkerData[],
  options?: UseMarkersOptions
): void {
  const map = useMap();
  const markersRef = useRef<Map<string, L.Marker>>(new Map());
  const layerGroupRef = useRef<L.LayerGroup | null>(null);
  const previousMarkersRef = useRef<string>(''); // Store serialized markers for comparison

  // Create a stable string representation of markers for comparison
  const markersKey = useMemo(() => {
    return markers.map(m => getMarkerKey(m)).sort().join('|');
  }, [markers]);

  const compareMarkers = options?.compareMarkers || defaultCompareMarkers;

  useEffect(() => {
    if (options?.debug) {
      console.log(`[useMarkers] Effect triggered. Previous key: "${previousMarkersRef.current}", New key: "${markersKey}"`);
      console.log(`[useMarkers] Current markers count: ${markersRef.current.size}, New markers count: ${markers.length}`);
      console.log(`[useMarkers] Current marker IDs:`, Array.from(markersRef.current.keys()));
      console.log(`[useMarkers] New marker IDs:`, markers.map(m => m.id));
    }
    
    // Skip if markers haven't actually changed (by key comparison)
    if (previousMarkersRef.current === markersKey && markersRef.current.size === markers.length) {
      if (options?.debug) {
        console.log(`[useMarkers] Skipping update - markers unchanged`);
      }
      return;
    }
    
    if (options?.debug) {
      console.log(`[useMarkers] Processing marker update...`);
    }

    // Create or get layer group
    if (options?.layerGroup) {
      layerGroupRef.current = options.layerGroup;
    } else {
      // Create a default layer group if none provided
      if (!layerGroupRef.current) {
        layerGroupRef.current = L.layerGroup().addTo(map);
      }
    }

    const layerGroup = layerGroupRef.current;
    const currentMarkers = markersRef.current;

    // Create a Set of current marker IDs
    const currentMarkerIds = new Set(currentMarkers.keys());
    const newMarkerIds = new Set(markers.map(m => m.id));

    // Remove markers that are no longer in the array
    currentMarkerIds.forEach(markerId => {
      if (!newMarkerIds.has(markerId)) {
        const marker = currentMarkers.get(markerId);
        if (marker) {
          if (options?.debug) {
            console.log(`[useMarkers] Removing marker: ${markerId}`);
          }
          try {
            // Remove from layer group first (this will also remove it from map if layer group is on map)
            if (layerGroup.hasLayer(marker)) {
              layerGroup.removeLayer(marker);
              if (options?.debug) {
                console.log(`[useMarkers] Removed marker ${markerId} from layer group`);
              }
            }
            // Also try direct removal as fallback
            // Check if marker is on a map by trying to get its map
            try {
              const markerMap = (marker as any)._map;
              if (markerMap) {
                marker.remove();
                if (options?.debug) {
                  console.log(`[useMarkers] Removed marker ${markerId} from map directly`);
                }
              }
            } catch (e) {
              // Ignore errors when checking for map
            }
          } catch (error) {
            if (options?.debug) {
              console.warn(`[useMarkers] Error removing marker ${markerId}:`, error);
            }
            // Force remove as last resort
            try {
              marker.remove();
            } catch (e) {
              // Ignore errors on force remove
            }
          }
          currentMarkers.delete(markerId);
        }
      }
    });

    // Add or update markers
    markers.forEach(markerData => {
      const existingMarker = currentMarkers.get(markerData.id);

      if (existingMarker) {
        // Always check if marker needs updating (position, icon, handlers)
        const [lat, lng] = markerData.position;
        const currentPos = existingMarker.getLatLng();
        const positionChanged = Math.abs(currentPos.lat - lat) > 0.0001 || Math.abs(currentPos.lng - lng) > 0.0001;
        const iconChanged = existingMarker.options.icon !== markerData.icon;
        
        if (positionChanged) {
          if (options?.debug) {
            console.log(`[useMarkers] Updating marker position: ${markerData.id}`);
          }
          existingMarker.setLatLng([lat, lng]);
        }

        if (iconChanged) {
          if (options?.debug) {
            console.log(`[useMarkers] Updating marker icon: ${markerData.id}`);
          }
          existingMarker.setIcon(markerData.icon);
        }

        // Always update handlers and popup to ensure they're current
        existingMarker.off('click');
        if (markerData.onClick) {
          existingMarker.on('click', markerData.onClick);
        }

        if (markerData.popup !== undefined) {
          if (markerData.popup) {
            existingMarker.bindPopup(markerData.popup);
          } else {
            existingMarker.unbindPopup();
          }
        }
      } else {
        // Create new marker
        if (options?.debug) {
          console.log(`[useMarkers] Adding marker: ${markerData.id}`);
        }
        
        try {
          const marker = L.marker(markerData.position, {
            icon: markerData.icon,
          });

          if (markerData.onClick) {
            marker.on('click', markerData.onClick);
          }

          if (markerData.popup) {
            marker.bindPopup(markerData.popup);
          }

          marker.addTo(layerGroup);
          currentMarkers.set(markerData.id, marker);
        } catch (error) {
          if (options?.debug) {
            console.error(`[useMarkers] Error adding marker ${markerData.id}:`, error);
          }
        }
      }
    });

    // Update previous markers reference
    previousMarkersRef.current = markersKey;

  }, [map, markers, markersKey, compareMarkers, options?.layerGroup, options?.debug]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      const currentMarkers = markersRef.current;
      const layerGroup = layerGroupRef.current;
      
      if (layerGroup && currentMarkers.size > 0) {
        if (options?.debug) {
          console.log(`[useMarkers] Unmounting: cleaning up ${currentMarkers.size} markers`);
        }
        
        currentMarkers.forEach((marker) => {
          layerGroup.removeLayer(marker);
          marker.remove();
        });
        currentMarkers.clear();
        
        if (!options?.layerGroup) {
          map.removeLayer(layerGroup);
        }
        layerGroupRef.current = null;
      }
    };
  }, [map, options?.layerGroup, options?.debug]);
}










