import { useEffect, useRef } from 'react';
import { useStore } from '../store/useStore';
import { batchGeocode } from '../services/api';
import { validateLngLat } from '../utils/coordinates';

/**
 * Hook to geocode all stops for all routes
 * Processes routes one at a time, showing progress per route
 * Runs in background without blocking UI
 */
export function useGeocodeStops() {
  const routes = useStore(state => state.routes);
  const updateStopCoordinates = useStore(state => state.updateStopCoordinates);
  const updateRouteGeocodingProgress = useStore(state => state.updateRouteGeocodingProgress);
  const setCurrentGeocodingRoute = useStore(state => state.setCurrentGeocodingRoute);
  const setError = useStore(state => state.setError);
  
  const geocodingRef = useRef<boolean>(false);
  const processedStopsRef = useRef<Set<string>>(new Set());
  const hasStartedRef = useRef<boolean>(false);

  useEffect(() => {
    // DISABLED: Geocoding is now done server-side when processing PDFs
    // Routes should already have coordinates loaded from processed JSON files
    // This hook is kept for backwards compatibility but won't run geocoding
    
    if (routes.length === 0) {
      return;
    }

    // Mark as checked so we don't run again
    hasStartedRef.current = true;

    // Check if any routes need geocoding (shouldn't happen if using processed routes)
    const needsGeocoding = routes.some(route => {
      const totalStops = route.stops.length;
      if (totalStops === 0) return false;
      const geocodedStops = route.stops.filter(s => {
        const coords = s.coordinates;
        return coords && Array.isArray(coords) && coords.length === 2;
      }).length;
      return geocodedStops < totalStops;
    });

    if (needsGeocoding) {
      // If we get here, some routes are missing coordinates
      // This shouldn't happen with processed routes, but log a warning
      console.warn('[Geocode] Some routes are missing coordinates. Geocoding is disabled - use the server-side script to process PDFs.');
    } else {
      console.log('[Geocode] All routes have coordinates - no geocoding needed (server-side processing)');
    }
    
    // OLD CODE - DISABLED (geocoding now happens server-side)
    /*
    const geocodeAllRoutes = async () => {
      try {
        // Wait a bit to ensure routes are fully loaded from cache
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Get fresh routes from store to ensure we have latest state
        const currentRoutes = useStore.getState().routes;
        
        if (currentRoutes.length === 0) {
          console.log('No routes to geocode');
          return;
        }
        
        console.log(`[Geocode] Checking ${currentRoutes.length} routes for geocoding...`);
        
        // Find routes that need geocoding (have stops without coordinates)
        const routesToGeocode = currentRoutes.filter(route => {
          const totalStops = route.stops.length;
          if (totalStops === 0) return false;
          
          const geocodedStops = route.stops.filter(s => {
            const coords = s.coordinates;
            return coords && 
                   Array.isArray(coords) && 
                   coords.length === 2 &&
                   typeof coords[0] === 'number' &&
                   typeof coords[1] === 'number' &&
                   !isNaN(coords[0]) &&
                   !isNaN(coords[1]);
          }).length;
          
          const needsGeocoding = geocodedStops < totalStops;
          
          if (needsGeocoding) {
            console.log(`[Geocode] Route ${route.name} needs geocoding: ${geocodedStops}/${totalStops} geocoded`);
          }
          
          return needsGeocoding;
        });

        if (routesToGeocode.length === 0) {
          const totalStops = currentRoutes.reduce((sum, r) => sum + r.stops.length, 0);
          const totalGeocoded = currentRoutes.reduce((sum, r) => 
            sum + r.stops.filter(s => {
              const coords = s.coordinates;
              return coords && Array.isArray(coords) && coords.length === 2;
            }).length, 0);
          
          console.log(`[Geocode] ✓ All routes already fully geocoded (${totalGeocoded}/${totalStops} stops)`);
          console.log('[Geocode] No geocoding needed - using cached coordinates');
          geocodingRef.current = false;
          hasStartedRef.current = true; // Mark as checked so we don't check again
          return;
        }

        geocodingRef.current = true;
        hasStartedRef.current = true;
        console.log(`Starting geocoding: ${routesToGeocode.length} routes need geocoding`);

        // Process each route one at a time
      for (const route of routesToGeocode) {
        // Collect stops that need geocoding for this route
        const stopsToGeocode: Array<{
          stopId: string;
          address: string;
        }> = [];

        console.log(`\n=== Processing route: ${route.name} ===`);
        console.log(`Total stops: ${route.stops.length}`);

        route.stops.forEach((stop, idx) => {
          const key = `${route.id}-${stop.id}`;
          // Check if stop needs geocoding (no coordinates or invalid coordinates)
          const hasValidCoordinates = stop.coordinates && 
                                     Array.isArray(stop.coordinates) && 
                                     stop.coordinates.length === 2 &&
                                     typeof stop.coordinates[0] === 'number' &&
                                     typeof stop.coordinates[1] === 'number';
          
          if (!hasValidCoordinates && !processedStopsRef.current.has(key)) {
            stopsToGeocode.push({
              stopId: stop.id,
              address: stop.address,
            });
            if (idx < 3) {
              console.log(`  Stop ${idx + 1} needs geocoding: "${stop.address}"`);
            }
          } else if (hasValidCoordinates) {
            if (idx < 3) {
              console.log(`  Stop ${idx + 1} already geocoded: "${stop.address}"`);
            }
          }
        });

        console.log(`Stops needing geocoding: ${stopsToGeocode.length}/${route.stops.length}`);

        if (stopsToGeocode.length === 0) {
          console.log(`Route ${route.name} already fully geocoded, skipping`);
          // This route is already done, mark it complete
          updateRouteGeocodingProgress(route.id, {
            total: route.stops.length,
            geocoded: route.stops.filter(s => {
              const coords = s.coordinates;
              return coords && Array.isArray(coords) && coords.length === 2;
            }).length,
            isGeocoding: false,
          });
          continue;
        }

        // Mark this route as currently geocoding
        setCurrentGeocodingRoute(route.id);
        updateRouteGeocodingProgress(route.id, {
          total: route.stops.length,
          geocoded: route.stops.filter(s => s.coordinates).length,
          isGeocoding: true,
        });

        console.log(`Geocoding route ${route.name}: ${stopsToGeocode.length} stops remaining`);

        // Process stops in batches of 10
        const batchSize = 10;
        let geocodedCount = 0;

        for (let i = 0; i < stopsToGeocode.length; i += batchSize) {
          const batch = stopsToGeocode.slice(i, i + batchSize);
          const addresses = batch.map(s => s.address);

          try {
            console.log(`\nGeocoding batch ${Math.floor(i / batchSize) + 1} for ${route.name}: ${addresses.length} addresses`);
            console.log(`Sample addresses:`, addresses.slice(0, 3));
            
            const response = await batchGeocode(addresses, 'Portland', 'OR');
            console.log(`Batch geocode response:`, response);
            
            const { results } = response;

            if (!results || !Array.isArray(results)) {
              console.error(`Invalid response from batchGeocode:`, response);
              continue;
            }
            
            console.log(`Received ${results.length} results from geocoding API`);

            let batchGeocoded = 0;
            results.forEach((result: any, index: number) => {
              const stopInfo = batch[index];
              if (stopInfo && result && result.success && result.coordinates) {
                const coords = result.coordinates;
                if (Array.isArray(coords) && coords.length === 2) {
                  // Validate coordinates before updating
                  if (validateLngLat(coords)) {
                    updateStopCoordinates(route.id, stopInfo.stopId, coords);
                    processedStopsRef.current.add(`${route.id}-${stopInfo.stopId}`);
                    geocodedCount++;
                    batchGeocoded++;
                    console.log(`✓ Geocoded: ${stopInfo.address} -> [${coords[0]}, ${coords[1]}]`);
                  } else {
                    console.error('[useGeocodeStops] Invalid coordinates from geocoding:', coords);
                  }
                } else {
                  console.warn(`Invalid coordinates for ${stopInfo.address}:`, coords);
                }
            } else {
              console.warn(`Failed to geocode ${stopInfo?.address}:`, result);
              if (result && result.error) {
                console.warn(`  Error: ${result.error}`);
              }
            }
          });
            
            console.log(`Batch complete: ${batchGeocoded}/${addresses.length} geocoded successfully`);
            
            if (batchGeocoded === 0) {
              console.warn(`WARNING: No stops were geocoded in this batch!`);
            }
            
            // Update progress after batch completes
            // Use a small delay to ensure state has updated
            await new Promise(resolve => setTimeout(resolve, 300));
            const currentState = useStore.getState();
            const currentRoute = currentState.routes.find(r => r.id === route.id);
            if (currentRoute) {
              const geocodedCount = currentRoute.stops.filter(s => 
                s.coordinates && 
                Array.isArray(s.coordinates) && 
                s.coordinates.length === 2
              ).length;
              updateRouteGeocodingProgress(route.id, {
                total: currentRoute.stops.length,
                geocoded: geocodedCount,
                isGeocoding: true,
              });
              console.log(`Route ${route.name} progress: ${geocodedCount}/${currentRoute.stops.length} geocoded`);
            }

            // Rate limiting: wait 1 second between batches
            if (i + batchSize < stopsToGeocode.length) {
              await new Promise(resolve => setTimeout(resolve, 1000));
            }
          } catch (error: any) {
            console.error(`Error geocoding batch ${Math.floor(i / batchSize) + 1} for ${route.name}:`, error);
            
            // Check if it's a network error (backend not running)
            if (error.message?.includes('Failed to fetch') || error.message?.includes('NetworkError')) {
              setError('Backend server not running. Please start it with: cd backend && npm run dev');
            } else {
              setError(`Geocoding error: ${error.message || 'Unknown error'}`);
            }
            
            // Continue with next batch even if this one fails
          }
        }

        // Mark route as complete - get current state from store
        await new Promise(resolve => setTimeout(resolve, 300));
        const currentState = useStore.getState();
        const finalRoute = currentState.routes.find(r => r.id === route.id);
        if (finalRoute) {
          const finalGeocoded = finalRoute.stops.filter(s => 
            s.coordinates && 
            Array.isArray(s.coordinates) && 
            s.coordinates.length === 2
          ).length;
          updateRouteGeocodingProgress(route.id, {
            total: finalRoute.stops.length,
            geocoded: finalGeocoded,
            isGeocoding: false,
          });
          console.log(`✓ Route ${route.name} complete: ${finalGeocoded}/${finalRoute.stops.length} geocoded`);
        }

        console.log(`Completed geocoding route ${route.name}`);
      }

      setCurrentGeocodingRoute(null);
      geocodingRef.current = false;
      console.log('✓ Background geocoding complete for all routes');
      } catch (error: any) {
        console.error('Fatal error in geocoding:', error);
        
        // Set error message
        if (error.message?.includes('Failed to fetch') || error.message?.includes('NetworkError')) {
          setError('Backend server not running. Please start it with: cd backend && npm run dev');
        } else {
          setError(`Geocoding failed: ${error.message || 'Unknown error'}`);
        }
        
        setCurrentGeocodingRoute(null);
        geocodingRef.current = false;
        hasStartedRef.current = false;
      }
    };

    // OLD CODE - DISABLED
    /*
    const timeoutId = setTimeout(() => {
      geocodeAllRoutes().catch(error => {
        console.error('[Geocode] Error:', error);
        setError(`Geocoding failed: ${error.message || 'Unknown error'}`);
        geocodingRef.current = false;
        hasStartedRef.current = false;
        setCurrentGeocodingRoute(null);
      });
    }, 1000);

    return () => {
      clearTimeout(timeoutId);
    };
    */
  }, [routes.length]); // Only depend on routes.length to avoid re-running when routes update
}
