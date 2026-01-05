import { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import { fetchRouteForStops } from '../services/routing';
import { generateRouteColor } from '../utils/colorGenerator';
import { formatStreetName } from '../utils/formatAddress';
import { DataRouteList } from '../components/DataRouteList';
import { Sidebar } from '../components/Sidebar';
import { SchoolList } from '../components/SchoolList';
import { TabBar } from '../components/TabBar';
import { DataPageHeader } from '../components/DataPageHeader';
import { useStore } from '../store/useStore';
import { School } from '../types';
import { getSchoolTypes, getSchoolColor, createSchoolIcon } from '../utils/schoolUtils';
import { handleMapLinkClick } from '../utils/mapLinks';
import { createDefaultMarkerIcon } from '../utils/fontAwesomeIcons';
import { createSchoolIcon as createSharedSchoolIcon, createNumberedIcon as createSharedNumberedIcon } from '../utils/markerIcons';
import 'leaflet/dist/leaflet.css';

// Set default marker icon to use Font Awesome
const defaultIcon = createDefaultMarkerIcon();
L.Marker.prototype.options.icon = defaultIcon;

interface ProcessedStop {
  id: string;
  address: string;
  time?: string;
  direction?: string | null;
  coordinates: [number, number] | null;
  geocodeError?: string;
  displayName?: string;
  isSchoolStop?: boolean;
  schoolName?: string;
  skipGeocoding?: boolean;
}

interface ProcessedRoute {
  id: string;
  name: string; // Route number only, e.g., "100"
  direction?: 'Morning' | 'Afternoon' | null; // "Morning" or "Afternoon"
  filename: string;
  stops: ProcessedStop[];
  processedAt: string;
  stats: {
    totalStops: number;
    geocodedStops: number;
    failedStops: number;
  };
}


interface SchedulerStatus {
  enabled: boolean;
  lastRun: string | null;
  lastRunStatus: 'success' | 'error' | 'running' | null;
  lastRunError: string | null;
  nextRun: string | null;
}

// Component to fit map bounds to show all schools
function FitSchoolBounds({ schools, selectedSchoolId }: { schools: School[]; selectedSchoolId: string | null }) {
  const map = useMap();
  const prevSelectedSchoolIdRef = useRef<string | null>(null);
  
  useEffect(() => {
    const schoolsWithCoords = schools.filter(s => s.coordinates && s.coordinates.length === 2);
    
    if (selectedSchoolId && schoolsWithCoords.length > 0) {
      // If a school is selected, zoom to it
      const selectedSchool = schoolsWithCoords.find(s => s.id === selectedSchoolId);
      if (selectedSchool && selectedSchool.coordinates) {
        const [lng, lat] = selectedSchool.coordinates;
        // Only zoom if this is a new selection
        if (prevSelectedSchoolIdRef.current !== selectedSchoolId) {
          map.setView([lat, lng], 16, { animate: true });
          prevSelectedSchoolIdRef.current = selectedSchoolId;
        }
        return;
      }
    }
    
    // If no school selected, fit bounds to show all schools
    if (!selectedSchoolId && schoolsWithCoords.length > 0) {
      // Only refit if we had a selection before (to avoid refitting on initial load)
      if (prevSelectedSchoolIdRef.current !== null) {
        const bounds = L.latLngBounds(
          schoolsWithCoords.map(s => [s.coordinates![1], s.coordinates![0]] as [number, number])
        );
        map.fitBounds(bounds, { padding: [50, 50], animate: true });
      }
      prevSelectedSchoolIdRef.current = null;
    } else if (!selectedSchoolId) {
      prevSelectedSchoolIdRef.current = null;
    }
  }, [map, schools, selectedSchoolId]);
  
  return null;
}

export function DataManagement() {
  const { selectedSchoolId, schools, setSchools, setSelectedSchool } = useStore();
  const [activeTab, setActiveTab] = useState<'schools' | 'routes'>('routes');
  
  // Wrapper to handle TabBar's expected type signature
  const handleTabChange = (tab: 'schools' | 'routes' | 'neighborhoods') => {
    if (tab === 'schools' || tab === 'routes') {
      setActiveTab(tab);
    }
  };
  const [routes, setRoutes] = useState<ProcessedRoute[]>([]);
  const [selectedStop, setSelectedStop] = useState<{ route: ProcessedRoute; stop: ProcessedStop } | null>(null);
  const [selectedSchoolForMap, setSelectedSchoolForMap] = useState<School | null>(null);
  const [originalCoordinates, setOriginalCoordinates] = useState<[number, number] | null>(null); // Track original coords to detect changes
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const mapRef = useRef<L.Map | null>(null);
  
  // Route geometry state - same as MapView
  interface RouteGeometry {
    [routeId: string]: [number, number][] | null; // null means still loading
  }
  const [routeGeometries, setRouteGeometries] = useState<RouteGeometry>({});
  
  // Timeout ref for debouncing route recalculation
  const routeRecalcTimeoutRef = useRef<{ [routeId: string]: ReturnType<typeof setTimeout> }>({});
  
  // Ref to store latest routes for recalculation (to avoid stale closure)
  const routesRef = useRef<ProcessedRoute[]>([]);
  
  // Scheduler state
  const [schedulerStatus, setSchedulerStatus] = useState<SchedulerStatus | null>(null);
  const [schedulerLoading, setSchedulerLoading] = useState(false);

  // Load schools if not already loaded
  useEffect(() => {
    if (schools.length === 0) {
      const loadSchools = async () => {
        try {
          const response = await fetch('/api/schools');
          if (response.ok) {
            const data = await response.json();
            setSchools(data.schools || []);
          }
        } catch (error) {
          console.error('Error loading schools:', error);
        }
      };
      loadSchools();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update selectedSchoolForMap when selectedSchoolId changes (for schools tab)
  useEffect(() => {
    if (activeTab === 'schools') {
      if (selectedSchoolId && schools.length > 0) {
        const school = schools.find(s => s.id === selectedSchoolId);
        setSelectedSchoolForMap(school || null);
      } else {
        setSelectedSchoolForMap(null);
      }
    } else {
      // Clear selectedSchoolForMap when not in schools tab
      setSelectedSchoolForMap(null);
    }
  }, [selectedSchoolId, schools, activeTab]);

  // Load processed routes
  useEffect(() => {
    if (!selectedSchoolId) {
      // If no school is selected, set loading to false and clear routes
      setLoading(false);
      setRoutes([]);
      return;
    }

    // Only load routes when in routes tab
    if (activeTab !== 'routes') {
      return;
    }

    setLoading(true); // Set loading to true when starting to load
    const loadRoutes = async () => {
      try {
        // Load from the processed-routes directory for selected school
        const response = await fetch(`/api/data/routes?schoolId=${encodeURIComponent(selectedSchoolId)}`);
        if (!response.ok) {
          throw new Error(`Failed to load routes: ${response.status} ${response.statusText}`);
        }
        const data = await response.json();
        
        // Migrate old format routes to new format (name with (AM)/(PM) -> separate direction)
        const migratedRoutes = (data.routes || []).map((route: ProcessedRoute) => {
          // Check if route name contains (AM) or (PM) - old format
          const amMatch = route.name.match(/^(\d+)\s*\(AM\)$/);
          const pmMatch = route.name.match(/^(\d+)\s*\(PM\)$/);
          
          if (amMatch) {
            return {
              ...route,
              name: amMatch[1], // Just the number
              direction: 'Morning' as const,
            };
          } else if (pmMatch) {
            return {
              ...route,
              name: pmMatch[1], // Just the number
              direction: 'Afternoon' as const,
            };
          }
          
          // Already in new format or no direction
          return route;
        });
        
        setRoutes(migratedRoutes);
        
        // If we have a selectedStop, sync it with the newly loaded routes
        if (selectedStop) {
          const updatedRoute = migratedRoutes.find((r: ProcessedRoute) => 
            r.id === selectedStop.route.id && 
            r.name === selectedStop.route.name &&
            r.direction === selectedStop.route.direction
          );
          if (updatedRoute) {
            const updatedStop = updatedRoute.stops.find((s: ProcessedStop) => s.id === selectedStop.stop.id);
            if (updatedStop) {
              setSelectedStop({
                route: updatedRoute,
                stop: updatedStop,
              });
            }
          }
        }
      } catch (error) {
        console.error('Error loading routes:', error);
        setRoutes([]); // Clear routes on error
        // Show error message to user
        alert(`Failed to load routes: ${error instanceof Error ? error.message : 'Unknown error'}\n\nMake sure the backend server is running on port 3001.`);
      } finally {
        setLoading(false);
      }
    };

    loadRoutes();
  }, [selectedSchoolId, activeTab]);

  // Load scheduler status
  useEffect(() => {
    const loadSchedulerStatus = async () => {
      try {
        const response = await fetch('/api/scheduler/status');
        if (response.ok) {
          const data = await response.json();
          setSchedulerStatus(data);
        }
      } catch (error) {
        console.error('Error loading scheduler status:', error);
      }
    };

    loadSchedulerStatus();
    // Refresh status every 30 seconds
    const interval = setInterval(loadSchedulerStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  // Sync routes ref with routes state (for recalculation function)
  useEffect(() => {
    routesRef.current = routes;
  }, [routes]);

  // Cleanup route recalculation timeouts on unmount
  useEffect(() => {
    return () => {
      Object.values(routeRecalcTimeoutRef.current).forEach(timeout => {
        if (timeout) clearTimeout(timeout);
      });
    };
  }, []);

  // Toggle scheduler
  const handleToggleScheduler = async () => {
    if (!schedulerStatus) return;
    
    setSchedulerLoading(true);
    try {
      const response = await fetch('/api/scheduler/toggle', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ enabled: !schedulerStatus.enabled }),
      });

      if (response.ok) {
        const data = await response.json();
        setSchedulerStatus(data);
      } else {
        alert('Failed to toggle scheduler');
      }
    } catch (error) {
      console.error('Error toggling scheduler:', error);
      alert('Failed to toggle scheduler');
    } finally {
      setSchedulerLoading(false);
    }
  };

  // Recalculate route geometry after stop coordinates change
  const recalculateRouteGeometry = async (routeId: string) => {
    // Use ref to get the latest routes (avoids stale closure)
    const route = routesRef.current.find(r => r.id === routeId);
    if (!route) {
      console.warn(`[DataManagement] Route ${routeId} not found`);
      return;
    }

    const stopsWithCoords = route.stops.filter(stop => stop.coordinates && !stop.skipGeocoding);
    
    if (stopsWithCoords.length < 2) {
      console.log(`[DataManagement] Route ${route.name} has insufficient stops (${stopsWithCoords.length}), clearing geometry`);
      setRouteGeometries(prev => ({ ...prev, [routeId]: [] }));
      return;
    }

    // Mark as loading
    setRouteGeometries(prev => ({ ...prev, [routeId]: null }));
    console.log(`[DataManagement] 🗺️  Recalculating route geometry for ${route.name} (${stopsWithCoords.length} stops)`);

    try {
      // Convert stops to [lng, lat] format for routing service
      const stopCoordinates: [number, number][] = stopsWithCoords.map(stop => {
        const [lng, lat] = stop.coordinates!;
        return [lng, lat];
      });

      // Fetch route following streets
      const routeCoordinates = await fetchRouteForStops(stopCoordinates);
      
      if (routeCoordinates && routeCoordinates.length > 0) {
        console.log(`[DataManagement] ✅ Route geometry updated for ${route.name}: ${routeCoordinates.length} points`);
        setRouteGeometries(prevState => ({ ...prevState, [routeId]: routeCoordinates }));
      } else {
        throw new Error('Route calculation returned empty coordinates');
      }
    } catch (error) {
      console.error(`[DataManagement] ❌ Error fetching route for ${route.name}:`, error);
      // Fallback to straight line
      const fallbackCoordinates = stopsWithCoords.map(stop => {
        const [lng, lat] = stop.coordinates!;
        return [lat, lng] as [number, number];
      });
      console.warn(`[DataManagement] ⚠️  Using straight-line fallback for ${route.name}`);
      setRouteGeometries(prevState => ({ ...prevState, [routeId]: fallbackCoordinates }));
    }
  };

  // Save updated coordinates
  const saveStopCoordinates = async (routeId: string, stopId: string, coordinates: [number, number]) => {
    // Validate coordinates format [lng, lat]
    const { validateLngLat } = await import('../utils/coordinates');
    if (!validateLngLat(coordinates)) {
      console.error('[DataManagement] Invalid coordinates format:', coordinates);
      throw new Error(`Invalid coordinates format. Expected [lng, lat], got ${JSON.stringify(coordinates)}`);
    }
    setSaving(true);
    try {
      const response = await fetch(`/api/data/routes/${routeId}/stops/${stopId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ coordinates, schoolId: selectedSchoolId }),
      });

      if (!response.ok) {
        throw new Error('Failed to save coordinates');
      }

      // Update local state
      setRoutes(prevRoutes => {
        const updatedRoutes = prevRoutes.map(route =>
          route.id === routeId
            ? {
                ...route,
                stops: route.stops.map(stop =>
                  stop.id === stopId
                    ? { ...stop, coordinates, geocodeError: undefined }
                    : stop
                ),
                stats: {
                  ...route.stats,
                  geocodedStops: route.stops.filter(s => s.id === stopId ? true : s.coordinates !== null).length + 1,
                  failedStops: route.stops.filter(s => s.id === stopId ? false : s.coordinates === null).length,
                },
              }
            : route
        );
        
        // Update selectedStop to sync with the updated routes
        if (selectedStop && selectedStop.route.id === routeId) {
          const updatedRoute = updatedRoutes.find(r => r.id === routeId);
          if (updatedRoute) {
            const updatedStop = updatedRoute.stops.find(s => s.id === stopId);
            if (updatedStop) {
              setSelectedStop({
                ...selectedStop,
                route: updatedRoute,
                stop: updatedStop,
              });
              // Update original coordinates to the saved coordinates
              setOriginalCoordinates([...coordinates] as [number, number]);
            }
          }
        }
        
        return updatedRoutes;
      });
      
      // Recalculate route geometry after successful save
      // Clear any existing timeout for this route
      if (routeRecalcTimeoutRef.current[routeId]) {
        clearTimeout(routeRecalcTimeoutRef.current[routeId]);
      }
      
      // Schedule route recalculation after a short delay to ensure state is updated
      routeRecalcTimeoutRef.current[routeId] = setTimeout(() => {
        recalculateRouteGeometry(routeId);
      }, 500);
    } catch (error) {
      console.error('Error saving coordinates:', error);
      alert('Failed to save coordinates');
    } finally {
      setSaving(false);
    }
  };

  const handleStopClick = (route: ProcessedRoute, stop: ProcessedStop) => {
    // Allow clicking any stop, even if it has no coordinates
    setSelectedStop({ route, stop });
    // Store original coordinates to detect changes
    setOriginalCoordinates(stop.coordinates ? [...stop.coordinates] as [number, number] : null);
  };

  // Handle marker drag - update coordinates
  const handleMarkerDrag = (newCoords: [number, number]) => {
    if (selectedStop) {
      setSelectedStop({
        ...selectedStop,
        route: {
          ...selectedStop.route,
          stops: selectedStop.route.stops.map(stop =>
            stop.id === selectedStop.stop.id
              ? { ...stop, coordinates: newCoords }
              : stop
          ),
        },
        stop: {
          ...selectedStop.stop,
          coordinates: newCoords,
        },
      });
      
      // Also update the routes state immediately so it's in sync
      setRoutes(prevRoutes =>
        prevRoutes.map(route =>
          route.id === selectedStop.route.id
            ? {
                ...route,
                stops: route.stops.map(stop =>
                  stop.id === selectedStop.stop.id
                    ? { ...stop, coordinates: newCoords }
                    : stop
                ),
              }
            : route
        )
      );
    }
  };

  // Handle marker click to select stop
  const handleMarkerClick = (route: ProcessedRoute, stop: ProcessedStop) => {
    handleStopClick(route, stop);
  };

  // Check if coordinates have changed from original
  const hasCoordinatesChanged = (): boolean => {
    if (!selectedStop || !selectedStop.stop.coordinates || !originalCoordinates) {
      return false;
    }
    const current = selectedStop.stop.coordinates;
    return Math.abs(current[0] - originalCoordinates[0]) > 0.000001 ||
           Math.abs(current[1] - originalCoordinates[1]) > 0.000001;
  };

  const handleSave = async () => {
    if (selectedStop && selectedStop.stop.coordinates) {
      setSaving(true);
      try {
        await saveStopCoordinates(selectedStop.route.id, selectedStop.stop.id, selectedStop.stop.coordinates);
        // Update original coordinates after save
        setOriginalCoordinates([...selectedStop.stop.coordinates] as [number, number]);
      } finally {
        setSaving(false);
      }
    }
  };

  // Fetch route geometry for the selected route - same approach as MapView
  useEffect(() => {
    if (!selectedStop) {
      setRouteGeometries({});
      return;
    }

    const route = selectedStop.route;
    setRouteGeometries(prev => {
      // Skip if already loaded
      if (prev[route.id] !== undefined) return prev;

      const stopsWithCoords = route.stops.filter(stop => stop.coordinates && !stop.skipGeocoding);
      
      if (stopsWithCoords.length < 2) {
        return { ...prev, [route.id]: [] };
      }

      // Mark as loading and fetch route asynchronously
      (async () => {
        try {
          const stopCoordinates: [number, number][] = stopsWithCoords.map(stop => {
            const [lng, lat] = stop.coordinates!;
            return [lng, lat];
          });

          const routeCoordinates = await fetchRouteForStops(stopCoordinates);
          setRouteGeometries(prevState => ({ ...prevState, [route.id]: routeCoordinates }));
        } catch (error) {
          console.error(`Error fetching route for ${route.name}:`, error);
          const fallbackCoordinates = stopsWithCoords.map(stop => {
            const [lng, lat] = stop.coordinates!;
            return [lat, lng] as [number, number];
          });
          setRouteGeometries(prevState => ({ ...prevState, [route.id]: fallbackCoordinates }));
        }
      })();

      return { ...prev, [route.id]: null }; // Mark as loading
    });
  }, [selectedStop?.route.id]);

  // Auto-fit bounds to show all stops when route changes - same as MapView
  useEffect(() => {
    if (mapRef.current && selectedStop) {
      const stopsWithCoords = selectedStop.route.stops.filter(stop => stop.coordinates && !stop.skipGeocoding);
      if (stopsWithCoords.length > 0) {
        const bounds = L.latLngBounds(
          stopsWithCoords.map(stop => {
            const [lng, lat] = stop.coordinates!;
            return [lat, lng] as [number, number];
          })
        );
        mapRef.current.fitBounds(bounds, { padding: [50, 50] });
      }
    }
  }, [selectedStop?.route.id]);

  // Zoom to selected stop when it changes
  useEffect(() => {
    if (mapRef.current && selectedStop && selectedStop.stop.coordinates) {
      const [lng, lat] = selectedStop.stop.coordinates;
      mapRef.current.setView([lat, lng], 18, { animate: true });
    }
  }, [selectedStop?.stop.id]);

  if (loading) {
    return (
      <div style={{ 
        padding: '2rem', 
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        gap: '1rem'
      }}>
        <div style={{
          width: '40px',
          height: '40px',
          border: '4px solid #4ECDC4',
          borderTopColor: 'transparent',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
        }} />
        <div style={{ fontSize: '18px' }}>Loading routes...</div>
        <div style={{ fontSize: '14px', color: '#666' }}>
          {selectedSchoolId ? `Loading routes for ${schools.find(s => s.id === selectedSchoolId)?.name || 'selected school'}...` : 'Select a school to load routes'}
        </div>
        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100vw' }}>
      {/* Top Header Bar */}
      <DataPageHeader
        title="Data Management"
        showAutoUpdate={true}
        schedulerStatus={schedulerStatus}
        onToggleScheduler={handleToggleScheduler}
        schedulerLoading={schedulerLoading}
      />

      {/* Main Content Area - Sidebar and Map */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
      {/* Sidebar - Route and Stop List */}
      <Sidebar
        header={null}
        tabs={<TabBar activeTab={activeTab} onTabChange={handleTabChange} />}
      >
        {activeTab === 'schools' ? (
          <SchoolList
            schools={schools}
            selectedSchoolId={selectedSchoolId}
            onSelectSchool={(schoolId) => {
              if (schoolId) {
                setSelectedSchool(schoolId);
                // When a school is selected, also update selectedSchoolForMap to show info dialog
                const school = schools.find(s => s.id === schoolId);
                if (school) {
                  setSelectedSchoolForMap(school);
                }
              } else {
                // Deselect school
                setSelectedSchool(null);
                setSelectedSchoolForMap(null);
              }
            }}
            enableEditing={true}
            onUpdateSchool={async (schoolId, updates) => {
              try {
                const response = await fetch(`/api/schools/${schoolId}`, {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(updates),
                });
                if (response.ok) {
                  const data = await response.json();
                  const updatedSchools = schools.map(s => s.id === schoolId ? data.school : s);
                  setSchools(updatedSchools);
                  // Update selectedSchoolForMap if this is the selected school
                  if (selectedSchoolId === schoolId) {
                    setSelectedSchoolForMap(data.school);
                  }
                } else {
                  alert('Failed to update school');
                }
              } catch (error) {
                console.error('Error updating school:', error);
                alert('Failed to update school');
              }
            }}
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {selectedSchoolId && (() => {
              const selectedSchool = schools.find(s => s.id === selectedSchoolId);
              return selectedSchool ? (
                <div style={{
                  padding: '0.75rem 1rem',
                  borderBottom: '1px solid #ddd',
                  backgroundColor: '#f9f9f9',
                  flexShrink: 0,
                }}>
                  <div style={{ fontSize: '12px', color: '#666', marginBottom: '0.25rem' }}>
                    Selected School
                  </div>
                  <div style={{ fontSize: '14px', fontWeight: '600', color: '#333' }}>
                    {selectedSchool.name}
                  </div>
                </div>
              ) : null;
            })()}
            <div style={{ flex: 1, overflow: 'auto' }}>
              <DataRouteList 
                routes={routes}
                selectedStop={selectedStop}
                onStopClick={handleStopClick}
                loading={loading}
              />
            </div>
          </div>
        )}
      </Sidebar>

      {/* Map Area */}
      <div style={{ flex: 1, position: 'relative' }}>

        {activeTab === 'schools' ? (
          // Schools map view
          (() => {
            const schoolsWithCoords = schools.filter(s => s.coordinates && s.coordinates.length === 2);
            return schoolsWithCoords.length > 0 ? (
              <MapContainer
                key="schools-map"
                center={[45.5152, -122.6784]} // Portland center
                zoom={12}
                style={{ height: '100%', width: '100%' }}
                ref={mapRef}
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                  url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
                />
                <FitSchoolBounds schools={schoolsWithCoords} selectedSchoolId={selectedSchoolId} />
                {schoolsWithCoords.map((school) => {
                  const schoolTypes = school.schoolTypes || getSchoolTypes(school.name);
                  const schoolColor = getSchoolColor(schoolTypes);
                  return (
                    <Marker
                      key={school.id}
                      position={[school.coordinates![1], school.coordinates![0]]}
                      icon={createSchoolIcon(schoolColor)}
                          eventHandlers={{
                            click: () => {
                              // Toggle selection: if already selected, deselect; otherwise select
                              if (selectedSchoolId === school.id) {
                                setSelectedSchool(null);
                                setSelectedSchoolForMap(null);
                              } else {
                                setSelectedSchool(school.id);
                                setSelectedSchoolForMap(school);
                              }
                            },
                          }}
                    />
                  );
                })}
              </MapContainer>
            ) : (
              <div style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                height: '100%',
                color: '#666',
              }}>
                No schools with coordinates to display on map
              </div>
            );
          })()
        ) : selectedStop ? (
          // Routes map view - using clean MapView approach
          <div style={{ position: 'relative', height: '100%', width: '100%' }}>
            <MapContainer
              center={[45.5152, -122.6784]}
              zoom={12}
              style={{ height: '100%', width: '100%' }}
              ref={mapRef}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
              />

              {/* Route lines and stop markers - same as MapView */}
              {(() => {
                const route = selectedStop.route;
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
                    const [lng, lat] = stop.coordinates!;
                    return [lat, lng] as [number, number];
                  });
                } else {
                  // Not loaded yet - show straight line
                  routeCoordinates = stopsWithCoords.map(stop => {
                    const [lng, lat] = stop.coordinates!;
                    return [lat, lng] as [number, number];
                  });
                }

                const routeColor = generateRouteColor(routes.findIndex(r => r.id === route.id));

                return (
                  <div key={route.id}>
                    {/* Route polyline - follows streets when available */}
                    {routeCoordinates.length > 1 && (
                      <Polyline
                        positions={routeCoordinates}
                        color={routeColor}
                        weight={3}
                        opacity={routeGeometry === null ? 0.4 : 0.8}
                      />
                    )}

                    {/* Stop markers with numbers - same as MapView */}
                    {stopsWithCoords.map((stop) => {
                      // Convert [lng, lat] to [lat, lng] for Leaflet
                      const [lng, lat] = stop.coordinates!;
                      const position: [number, number] = [lat, lng];
                      const isSelected = stop.id === selectedStop.stop.id;
                      
                      // Determine stop number and icon - same logic as MapView
                      let stopNumber: number;
                      let icon: L.DivIcon;
                      
                      if (stop.isSchoolStop) {
                        // School stop: use school icon, no number
                        stopNumber = 0;
                        icon = createSharedSchoolIcon(routeColor, stop.time);
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
                        const markerColor = isSelected ? '#ff4444' : '#888888';
                        icon = createSharedNumberedIcon(stopNumber, markerColor, stop.time, isSelected);
                      }

                      return (
                        <Marker
                          key={stop.id}
                          position={position}
                          icon={icon}
                          draggable={isSelected}
                          eventHandlers={{
                            ...(isSelected ? {
                              dragend: (e) => {
                                const marker = e.target;
                                const latlng = marker.getLatLng();
                                const newPos: [number, number] = [latlng.lng, latlng.lat];
                                handleMarkerDrag(newPos);
                              },
                            } : {}),
                            click: () => {
                              handleMarkerClick(route, stop);
                            },
                          }}
                        />
                      );
                    })}
                  </div>
                );
              })()}
            </MapContainer>

            {/* Stop info overlay - same as MapView but with save button */}
            {selectedStop && (
              <div
                style={{
                  position: 'absolute',
                  bottom: '1rem',
                  right: '1rem',
                  backgroundColor: 'white',
                  padding: '1rem 1.5rem',
                  borderRadius: '8px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                  minWidth: '300px',
                  maxWidth: '400px',
                  zIndex: 1000,
                  border: `2px solid ${generateRouteColor(routes.findIndex(r => r.id === selectedStop.route.id))}`,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                  <div>
                    <div style={{ fontWeight: 'bold', fontSize: '16px', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <span>{selectedStop.route.name}</span>
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
                    {selectedStop.stop.isSchoolStop && (
                      <div style={{ fontSize: '14px', color: '#666', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <span>🏫</span> School Loading Zone
                      </div>
                    )}
                    <div style={{ fontSize: '15px', fontWeight: '500', marginBottom: '0.25rem' }}>
                      {selectedStop.stop.isSchoolStop && selectedStop.stop.schoolName 
                        ? selectedStop.stop.schoolName 
                        : formatStreetName(selectedStop.stop.address)}
                    </div>
                    {selectedStop.stop.time && (
                      <div style={{ fontSize: '14px', color: '#666' }}>
                        {selectedStop.stop.time}
                      </div>
                    )}
                    {selectedStop.stop.coordinates && (
                      <div style={{ fontSize: '12px', color: '#666', marginTop: '0.5rem' }}>
                        Coordinates: [{selectedStop.stop.coordinates[0].toFixed(6)}, {selectedStop.stop.coordinates[1].toFixed(6)}]
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => setSelectedStop(null)}
                    style={{
                      background: 'none',
                      border: 'none',
                      fontSize: '20px',
                      cursor: 'pointer',
                      color: '#666',
                      padding: '0',
                      marginLeft: '1rem',
                      lineHeight: '1',
                    }}
                    title="Close"
                  >
                    ×
                  </button>
                </div>
                {selectedStop.stop.coordinates && (
                  <button
                    onClick={handleSave}
                    disabled={saving || !hasCoordinatesChanged()}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      backgroundColor: hasCoordinatesChanged() ? '#4ECDC4' : '#ccc',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      fontSize: '14px',
                      fontWeight: 'bold',
                      cursor: (saving || !hasCoordinatesChanged()) ? 'not-allowed' : 'pointer',
                      opacity: saving ? 0.6 : 1,
                      marginTop: '0.5rem',
                    }}
                  >
                    {saving ? 'Saving...' : hasCoordinatesChanged() ? 'Save Coordinates' : 'No changes'}
                  </button>
                )}
              </div>
            )}

          </div>
        ) : (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              color: '#666',
              fontSize: '18px',
            }}
          >
            Select a stop to view and edit on the map
          </div>
        )}

        {/* Selected school info dialog (when in schools tab) */}
        {activeTab === 'schools' && selectedSchoolForMap && (
          <div style={{
            position: 'absolute',
            bottom: '1rem',
            right: '1rem',
            backgroundColor: 'white',
            padding: '1.5rem',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            maxWidth: '400px',
            zIndex: 1000,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '1rem' }}>
              <div style={{ flex: 1 }}>
                <h2 style={{ margin: 0, fontSize: '20px', color: '#333', marginBottom: '0.5rem' }}>{selectedSchoolForMap.name}</h2>
                {(() => {
                  const schoolTypes = selectedSchoolForMap.schoolTypes || getSchoolTypes(selectedSchoolForMap.name);
                  const schoolColor = getSchoolColor(schoolTypes);
                  return (
                    <div style={{ fontSize: '14px', color: schoolColor, fontWeight: '500', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <i className="fas fa-graduation-cap" style={{ fontSize: '14px' }}></i>
                      <span>{schoolTypes.join(' & ')}</span>
                    </div>
                  );
                })()}
              </div>
              <button
                onClick={() => {
                  // Deselect school and zoom out to show all schools
                  setSelectedSchool(null);
                  setSelectedSchoolForMap(null);
                  // Trigger map bounds update
                  if (mapRef.current) {
                    const schoolsWithCoords = schools.filter(s => s.coordinates && s.coordinates.length === 2);
                    if (schoolsWithCoords.length > 0) {
                      const bounds = L.latLngBounds(
                        schoolsWithCoords.map(s => [s.coordinates![1], s.coordinates![0]] as [number, number])
                      );
                      mapRef.current.fitBounds(bounds, { padding: [50, 50], animate: true });
                    }
                  }
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '20px',
                  cursor: 'pointer',
                  color: '#999',
                  padding: '0',
                  lineHeight: '1',
                }}
              >
                ×
              </button>
            </div>
            {selectedSchoolForMap.routeCount !== undefined && (
              <div style={{ marginBottom: '0.75rem' }}>
                <div style={{ fontSize: '12px', color: '#666', marginBottom: '0.25rem' }}>Routes</div>
                <div 
                  onClick={() => {
                    setSelectedSchool(selectedSchoolForMap.id);
                    setActiveTab('routes');
                  }}
                  style={{ 
                    fontSize: '14px', 
                    color: '#000', 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '0.5rem',
                    cursor: 'pointer',
                    textDecoration: 'none',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.textDecoration = 'underline';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.textDecoration = 'none';
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 12h18M3 6h18M3 18h18"></path>
                    <circle cx="6" cy="12" r="2"></circle>
                    <circle cx="18" cy="12" r="2"></circle>
                  </svg>
                  <span>{selectedSchoolForMap.routeCount} {selectedSchoolForMap.routeCount === 1 ? 'route' : 'routes'} available</span>
                </div>
              </div>
            )}
            {selectedSchoolForMap.address && (
              <div style={{ marginBottom: '0.75rem' }}>
                <div style={{ fontSize: '12px', color: '#666', marginBottom: '0.25rem' }}>Address</div>
                <a
                  href="#"
                  onClick={(e) => handleMapLinkClick(e, selectedSchoolForMap.address!, selectedSchoolForMap.coordinates)}
                  style={{
                    fontSize: '14px',
                    color: '#000',
                    textDecoration: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.textDecoration = 'underline';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.textDecoration = 'none';
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                    <circle cx="12" cy="10" r="3"></circle>
                  </svg>
                  <span>{selectedSchoolForMap.address}</span>
                </a>
              </div>
            )}
            {selectedSchoolForMap.schoolPageLink && (
              <div style={{ marginBottom: '0.75rem' }}>
                <a
                  href={selectedSchoolForMap.schoolPageLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    fontSize: '14px',
                    color: '#000',
                    textDecoration: 'none',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.textDecoration = 'underline';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.textDecoration = 'none';
                  }}
                >
                  View School Page →
                </a>
              </div>
            )}
            {selectedSchoolForMap.driveLink && (
              <div>
                <a
                  href={selectedSchoolForMap.driveLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    fontSize: '14px',
                    color: '#000',
                    textDecoration: 'none',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.textDecoration = 'underline';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.textDecoration = 'none';
                  }}
                >
                  View Drive Folder →
                </a>
              </div>
            )}
          </div>
        )}
      </div>
      </div>
      <style dangerouslySetInnerHTML={{
        __html: '@keyframes spin { to { transform: rotate(360deg); } }'
      }} />
    </div>
  );
}

