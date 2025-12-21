import { useState, useEffect, useRef, useMemo } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { MapContainer, useMap, Marker, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import { RouteList } from './components/RouteList';
import { MapView } from './components/MapView';
import { SchoolInfoTooltip } from './components/SchoolInfoTooltip';
import { AddressInput } from './components/AddressInput';
import { AddressLookup } from './components/AddressLookup';
import { SchoolList } from './components/SchoolList';
import { TabBar } from './components/TabBar';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { MapInfoPanel } from './components/MapInfoPanel';
import { DarkModeTileLayer } from './components/DarkModeTileLayer';
import { SEO } from './components/SEO';
import { useStore } from './store/useStore';
import { SchoolsList } from './pages/SchoolsList';
import { SchoolDirectory } from './pages/SchoolDirectory';
import { NeighborhoodDirectory } from './pages/NeighborhoodDirectory';
import { Neighborhoods } from './pages/Neighborhoods';
import { TechPage } from './pages/TechPage';
import { VerificationPage } from './pages/VerificationPage';
import { JobsPage } from './pages/JobsPage';
import { HomePage } from './pages/HomePage';
import { AboutPage } from './pages/AboutPage';
import { ContactPage } from './pages/ContactPage';
import { ServersPage } from './pages/ServersPage';
import { ArchitecturePage } from './pages/ArchitecturePage';
import { School } from './types';
import { loadLocalRoutes } from './services/localRoutes';
import { getSchoolTypes, getSchoolColor, createSchoolIcon } from './utils/schoolUtils';
import { formatDate } from './utils/dateUtils';
import { createDefaultMarkerIcon, createHomeIcon } from './utils/fontAwesomeIcons';
import { handleMapLinkClick } from './utils/mapLinks';
import { SchoolTypeFilters } from './components/SchoolTypeFilter';
import { ProgressBar } from './components/ProgressBar';
import { AdminPasswordProtection } from './components/AdminPasswordProtection';
import { useIsMobile } from './hooks/useMediaQuery';
import { useUrlState } from './hooks/useUrlState';
import { usePageTracking } from './hooks/usePageTracking';
import { analyticsService } from './services/analytics';
import { parseUrlPath, applyUrlStateToRoutes } from './services/urlState';
import { useLocation, useNavigate } from 'react-router-dom';
import 'leaflet/dist/leaflet.css';

// Set default marker icon to use Font Awesome
const defaultIcon = createDefaultMarkerIcon();
L.Marker.prototype.options.icon = defaultIcon;

// Component to manage school markers on map
function SchoolListMapView({ 
  schools, 
  selectedSchoolId, 
  onSelectSchool,
  mapRef 
}: { 
  schools: School[]; // Already filtered schools
  selectedSchoolId: string | null; 
  onSelectSchool: (schoolId: string | null) => void;
  mapRef: React.RefObject<L.Map>;
}) {
  const { homeAddress } = useStore();
  const containerRef = useRef<HTMLDivElement>(null);
  const schoolsWithCoords = schools.filter(s => s.coordinates && s.coordinates.length === 2);
  const homeIcon = useMemo(() => createHomeIcon(), []);

  // Handle map resizing when sidebar changes
  useEffect(() => {
    if (!containerRef.current || !mapRef.current) return;

    const resizeObserver = new ResizeObserver(() => {
      if (mapRef.current) {
        mapRef.current.invalidateSize({ animate: true });
      }
    });

    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, [mapRef]);
  
  if (schoolsWithCoords.length === 0 && !homeAddress) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100%',
        color: 'var(--text-tertiary)',
      }}>
        No data to display on map
      </div>
    );
  }

  return (
    <div ref={containerRef} style={{ height: '100%', width: '100%' }}>
      <MapContainer
        key="schools-map"
        center={[45.5152, -122.6784]}
        zoom={12}
        style={{ height: '100%', width: '100%' }}
        ref={mapRef}
        zoomControl={false}
      >
        <DarkModeTileLayer />
        <FitSchoolBounds schools={schoolsWithCoords} selectedSchoolId={selectedSchoolId} />
        
        {/* Home address marker */}
        {homeAddress && (
          <Marker 
            position={[homeAddress.coordinates[1], homeAddress.coordinates[0]]} 
            icon={homeIcon}
          />
        )}

        {schoolsWithCoords.map(school => {
          const isSelected = selectedSchoolId === school.id;
          const schoolTypes = school.schoolTypes || getSchoolTypes(school.name);
          const schoolColor = getSchoolColor(schoolTypes);
          const icon = createSchoolIcon(schoolColor);
          const position = [school.coordinates![1], school.coordinates![0]] as [number, number];

          return (
            <Marker 
              key={school.id}
              position={position}
              icon={icon}
              eventHandlers={{
                click: () => onSelectSchool(isSelected ? null : school.id)
              }}
              zIndexOffset={isSelected ? 1000 : 0}
            />
          );
        })}
      </MapContainer>

      <MapInfoPanel 
        isOpen={!!selectedSchoolId} 
        onClose={() => onSelectSchool(null)}
      >
        {selectedSchoolId && (() => {
          const school = schools.find(s => s.id === selectedSchoolId);
          if (!school) return null;
          return (
            <SchoolInfoTooltip 
              school={school} 
              showRoutesButton={true}
              onClose={() => onSelectSchool(null)}
              onViewRoutes={() => {
                useStore.getState().setSelectedSchool(school.id);
                // This event is caught in ExplorerApp/AdminApp to change the tab
                window.dispatchEvent(new CustomEvent('change-tab', { detail: 'routes' }));
              }}
            />
          );
        })()}
      </MapInfoPanel>
    </div>
  );
}

// Component to fit map bounds to show all schools
function FitSchoolBounds({ schools, selectedSchoolId }: { schools: School[]; selectedSchoolId: string | null }) {
  const map = useMap();
  const { homeAddress } = useStore();
  const prevSelectedSchoolIdRef = useRef<string | null>(null);
  const mapReadyRef = useRef<boolean>(false);
  const hasZoomedRef = useRef<boolean>(false);
  
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

    const schoolsWithCoords = schools.filter(s => s.coordinates && s.coordinates.length === 2);
    
    if (selectedSchoolId && schoolsWithCoords.length > 0) {
      // If a school is selected, zoom to it
      const selectedSchool = schoolsWithCoords.find(s => s.id === selectedSchoolId);
      if (selectedSchool && selectedSchool.coordinates) {
        const [lng, lat] = selectedSchool.coordinates;
        const isNewSelection = prevSelectedSchoolIdRef.current !== selectedSchoolId;
        
        if (isNewSelection || !hasZoomedRef.current) {
          // Update ref immediately to prevent multiple setViews for same selection
          prevSelectedSchoolIdRef.current = selectedSchoolId;
          
          if (isNewSelection) {
            hasZoomedRef.current = false;
          }

          const timer = setTimeout(() => {
            try {
              // Calculate a target center that is shifted so the pin is 100px above the center
              const zoom = 16;
              const targetPoint = map.project([lat, lng], zoom).add([0, 100]);
              const targetLatLng = map.unproject(targetPoint, zoom);

              map.setView(targetLatLng, zoom, { 
                animate: true,
                duration: 0.6
              });
              
              hasZoomedRef.current = true;
              console.log('[FitSchoolBounds] 🎯 Centered and shifted map on school:', selectedSchool.name);
            } catch (error) {
              console.error('[FitSchoolBounds] Error zooming to school:', error);
            }
          }, 150);
          
          return () => clearTimeout(timer);
        }
        return;
      }
    }
    
    // If no school selected, fit bounds to show all schools (and home pin)
    if (!selectedSchoolId && (schoolsWithCoords.length > 0 || homeAddress)) {
      // Only refit if we had a selection before (to avoid refitting on initial load)
      if (prevSelectedSchoolIdRef.current !== null) {
        const allCoords: [number, number][] = schoolsWithCoords.map(s => [s.coordinates![1], s.coordinates![0]] as [number, number]);
        
        if (homeAddress) {
          allCoords.push([homeAddress.coordinates[1], homeAddress.coordinates[0]]);
        }

        if (allCoords.length > 0) {
          const bounds = L.latLngBounds(allCoords);
          
          // Use a small delay for zoom out to ensure smooth transition
          const timer = setTimeout(() => {
            try {
              map.fitBounds(bounds, { 
                padding: [50, 50], 
                animate: true,
                duration: 0.8
              });
              hasZoomedRef.current = false;
            } catch (error) {
              console.error('[FitSchoolBounds] Error fitting bounds:', error);
            }
          }, 100);
          
          prevSelectedSchoolIdRef.current = null;
          return () => clearTimeout(timer);
        }
      }
      prevSelectedSchoolIdRef.current = null;
    } else if (!selectedSchoolId) {
      prevSelectedSchoolIdRef.current = null;
      hasZoomedRef.current = false;
    }
  }, [map, schools, selectedSchoolId, homeAddress]);
  
  return null;
}

function ExplorerApp() {
  const { isLoading, selectedSchoolId, setSelectedSchool, schools, setSchools, setRoutes, setLoading, setLoadingProgress, routes, directionFilter, selectedStop } = useStore();
  const isMobile = useIsMobile();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Listen for tab change events
  useEffect(() => {
    const handleTabChangeEvent = (e: any) => {
      if (e.detail === 'routes' || e.detail === 'schools') {
        setActiveTab(e.detail);
      }
    };
    window.addEventListener('change-tab', handleTabChangeEvent);
    return () => window.removeEventListener('change-tab', handleTabChangeEvent);
  }, []);

  // Parse URL to determine initial active tab
  const urlState = parseUrlPath(location.pathname, '/bus-route-explorer');
  const [activeTab, setActiveTab] = useState<'schools' | 'routes'>(() => {
    // Check URL first, then localStorage, then default
    if (urlState.show) {
      return urlState.show;
    }
    // Check localStorage directly for initial render (before store hydration)
    if (typeof window !== 'undefined') {
      const savedSchoolId = localStorage.getItem('selectedSchoolId');
      const savedAddress = localStorage.getItem('homeAddress');
      if (savedSchoolId && savedAddress) {
        return 'routes';
      }
    }
    return 'schools';
  });

  // Get selected routes, filtered by direction
  const selectedRoutes = useMemo(() => {
    return routes.filter(route => {
      if (!route.isSelected) return false;
      if (directionFilter === 'Both') return true;
      if (!route.direction) return true;
      return route.direction === directionFilter;
    });
  }, [routes, directionFilter]);

  // Wrapper to handle TabBar's expected type signature
  const handleTabChange = (tab: 'schools' | 'routes' | 'neighborhoods') => {
    if (tab === 'schools' || tab === 'routes') {
      setActiveTab(tab);
      // URL will be updated automatically by useUrlState hook
      // Sidebar stays open on mobile when switching tabs
    }
  };
  const mapRef = useRef<L.Map | null>(null);
  const prevSchoolIdRef = useRef<string | null>(null);
  const [schoolTypeFilters, setSchoolTypeFilters] = useState<SchoolTypeFilters>({
    elementary: true,
    middle: true,
    high: true,
    hybrid: true,
  });
  const [searchTerm, setSearchTerm] = useState('');
  
  // Clear search term when sidebar closes
  useEffect(() => {
    if (!sidebarOpen && isMobile) {
      setSearchTerm('');
    }
  }, [sidebarOpen, isMobile]);
  
  // Reset loading state on mount if routes are already loaded
  useEffect(() => {
    if (routes.length > 0 && isLoading) {
      console.log('[ExplorerApp] Routes already loaded on mount, resetting loading state');
      setLoading(false);
    }
    // Also ensure loading is false if no school is selected
    if (!selectedSchoolId && isLoading) {
      console.log('[ExplorerApp] No school selected, resetting loading state');
      setLoading(false);
    }
  }, []); // Only run on mount
  
  // Load schools
  useEffect(() => {
    const loadSchools = async () => {
      try {
        console.log('[ExplorerApp] Loading schools with stats...');
        const response = await fetch('/api/schools?includeStats=true');
        if (response.ok) {
          const data = await response.json();
          console.log('[ExplorerApp] Loaded', data.schools?.length || 0, 'schools');
          setSchools(data.schools || []);
        } else {
          console.error('[ExplorerApp] Failed to load schools:', response.status, response.statusText);
        }
      } catch (error) {
        console.error('[ExplorerApp] Error loading schools:', error);
      }
    };
    loadSchools();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Initialize URL state sync (only after schools are loaded)
  const { cancelPendingUrlUpdate, markRouteToggle } = useUrlState({
    basePath: '/bus-route-explorer',
    schools,
    routes,
    activeTab,
    setActiveTab,
    debounceMs: 300,
  });

  // Load routes when school changes (only when in routes tab)
  useEffect(() => {
    if (!selectedSchoolId || activeTab !== 'routes') {
      console.log('[ExplorerApp] No school selected or not in routes tab, skipping route load');
      if (activeTab !== 'routes') {
        setRoutes([]);
      } else if (!selectedSchoolId) {
        // If in routes tab but no school selected, clear routes (RouteList will show empty state)
        setRoutes([]);
      }
      return;
    }

    // Check if we need to load routes
    const isInitialMount = prevSchoolIdRef.current === null;
    const schoolChanged = prevSchoolIdRef.current !== selectedSchoolId;
    
    // On initial mount with existing routes from navigation, skip reload
    if (isInitialMount && routes.length > 0 && routes.some(r => r.stops && r.stops.length > 0)) {
      console.log('[ExplorerApp] Routes already loaded (from navigation), skipping initial reload');
      prevSchoolIdRef.current = selectedSchoolId;
      setLoading(false);
      return;
    }

    // If school hasn't changed and we have valid routes, skip reload
    if (!schoolChanged && !isInitialMount && routes.length > 0 && routes.some(r => r.stops && r.stops.length > 0)) {
      console.log('[ExplorerApp] School unchanged and routes already loaded, skipping reload');
      setLoading(false);
      return;
    }

    // Load routes for the selected school
    console.log('[ExplorerApp] Loading routes for school:', selectedSchoolId, isInitialMount ? '(initial mount)' : '(school changed)');

    const loadRoutes = async () => {
      setLoading(true);
      setLoadingProgress(0);
      try {
        const loadedRoutes = await loadLocalRoutes(selectedSchoolId);
        
        // Pre-apply URL state to avoid UI flicker
        const urlState = parseUrlPath(window.location.pathname, '/bus-route-explorer');
        const syncedRoutes = applyUrlStateToRoutes(loadedRoutes, urlState, directionFilter);
        
        console.log('[ExplorerApp] Loaded', loadedRoutes.length, 'routes');
        setRoutes(syncedRoutes);
        setLoadingProgress(100);
      } catch (error) {
        console.error('[ExplorerApp] Failed to load routes:', error);
        setRoutes([]); // Set empty array on error
      } finally {
        setLoading(false);
        setLoadingProgress(null);
      }
    };

    loadRoutes();
    prevSchoolIdRef.current = selectedSchoolId;
  }, [selectedSchoolId, activeTab, setRoutes, setLoading, routes.length]); // Include routes.length to detect when routes are cleared

  // Filter schools based on search and type filters
  const filteredSchools = useMemo(() => {
    return schools.filter(school => {
      // Search filter
      const matchesSearch = 
        school.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (school.address && school.address.toLowerCase().includes(searchTerm.toLowerCase()));
      
      if (!matchesSearch) return false;
      
      // School type filter
      const schoolTypes = school.schoolTypes || getSchoolTypes(school.name);
      const isHybrid = schoolTypes.includes('Hybrid');
      
      // If it's a hybrid school, check hybrid filter
      if (isHybrid) {
        if (schoolTypeFilters.hybrid) {
          return true; // Show hybrid schools if hybrid filter is enabled
        }
        // If hybrid filter is disabled, don't show hybrid schools
        return false;
      }
      
      // For non-hybrid schools, check individual type filters
      const matchesFilter = 
        (schoolTypes.includes('Elementary School') && schoolTypeFilters.elementary) ||
        (schoolTypes.includes('Middle School') && schoolTypeFilters.middle) ||
        (schoolTypes.includes('High School') && schoolTypeFilters.high);
      
      return matchesFilter;
    });
  }, [schools, searchTerm, schoolTypeFilters]);

  // Geocoding is now done server-side when processing PDFs
  // Routes should already have coordinates loaded from processed JSON files
  // useGeocodeStops(); // DISABLED - no client-side geocoding needed

  // Custom thin X icon component
  const ThinXIcon = () => (
    <div style={{
      width: '18px',
      height: '18px',
      position: 'relative',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
    }}>
      <span style={{
        display: 'block',
        height: '1.5px',
        width: '100%',
        backgroundColor: 'currentColor',
        borderRadius: '2px',
        position: 'absolute',
        transform: 'rotate(45deg)',
        transformOrigin: 'center',
      }} />
      <span style={{
        display: 'block',
        height: '1.5px',
        width: '100%',
        backgroundColor: 'currentColor',
        borderRadius: '2px',
        position: 'absolute',
        transform: 'rotate(-45deg)',
        transformOrigin: 'center',
      }} />
    </div>
  );

  // Custom Hamburger/Close icon component
  const HamburgerIcon = ({ isOpen }: { isOpen: boolean }) => (
    <div style={{
      width: '24px',
      height: '18px',
      position: 'relative',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
    }}>
      <span style={{
        display: 'block',
        height: '1.5px',
        width: '100%',
        backgroundColor: 'white',
        borderRadius: '2px',
        transition: 'all 0.3s ease',
        position: 'absolute',
        transform: isOpen ? 'rotate(45deg)' : 'translateY(-6px)',
        transformOrigin: 'center',
      }} />
      <span style={{
        display: 'block',
        height: '1.5px',
        width: '100%',
        backgroundColor: 'white',
        borderRadius: '2px',
        transition: 'all 0.3s ease',
        opacity: isOpen ? 0 : 1,
        transform: isOpen ? 'scale(0)' : 'none',
      }} />
      <span style={{
        display: 'block',
        height: '1.5px',
        width: '100%',
        backgroundColor: 'white',
        borderRadius: '2px',
        transition: 'all 0.3s ease',
        position: 'absolute',
        transform: isOpen ? 'rotate(-45deg)' : 'translateY(6px)',
        transformOrigin: 'center',
      }} />
    </div>
  );

  // Hamburger menu button for mobile
  const hamburgerButton = isMobile ? (
    <button
      onClick={() => setSidebarOpen(!sidebarOpen)}
      style={{
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        color: 'white',
        padding: '0.5rem 13px 0.5rem 0.5rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '40px',
        height: '40px',
        borderRadius: '9999px',
      }}
      aria-label={sidebarOpen ? "Close menu" : "Open menu"}
    >
      <HamburgerIcon isOpen={sidebarOpen} />
    </button>
  ) : null;

  const selectedSchool = useMemo(() => 
    schools.find(s => s.id === selectedSchoolId),
    [schools, selectedSchoolId]
  );

  // Prevent viewport shifting on mobile navigation/route selection
  useEffect(() => {
    if (isMobile) {
      // Reset any accidental window scroll that Safari might have performed
      window.scrollTo(0, 0);
      
      // Ensure body is locked to prevent background scrolling
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.width = '100%';
      document.body.style.height = '100%';
      
      return () => {
        document.body.style.overflow = '';
        document.body.style.position = '';
        document.body.style.width = '';
        document.body.style.height = '';
      };
    }
  }, [isMobile, location.pathname]);

  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      height: 'var(--app-height)', 
      width: '100vw',
      position: isMobile ? 'fixed' : 'relative',
      top: 0,
      left: 0,
      overflow: 'hidden'
    }}>
      <SEO 
        title={selectedSchool ? `${selectedSchool.name} Bus Routes` : 'Bus Route Explorer'}
        description={selectedSchool 
          ? `View bus routes and stops for ${selectedSchool.name} in Portland. See interactive maps and stop schedules.`
          : 'Explore Portland Public Schools bus routes and stops on an interactive map.'
        }
        school={selectedSchool}
      />
      <Header rightContent={
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {hamburgerButton}
        </div>
      } />
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Sidebar */}
        <Sidebar
          header={null}
          tabs={<TabBar activeTab={activeTab} onTabChange={handleTabChange} />}
          isOpen={!isMobile || sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          persistenceKey="sidebar-width-explorer"
        >
          {activeTab === 'schools' ? (
            <SchoolList
              schools={schools}
              selectedSchoolId={selectedSchoolId}
              searchTerm={searchTerm}
              onSearchChange={setSearchTerm}
              schoolTypeFilters={schoolTypeFilters}
              onFiltersChange={setSchoolTypeFilters}
              onSelectSchool={(schoolId) => {
                if (selectedSchoolId === schoolId) {
                  setSelectedSchool(null);
                } else {
                  setSelectedSchool(schoolId);
                }
                if (schoolId && isMobile) {
                  setSidebarOpen(false);
                }
              }}
            />
          ) : (
            <RouteList 
              showBothOption={false}
              onClearSchool={() => {
                setSelectedSchool(null);
                setActiveTab('schools');
              }}
              onViewSchools={() => setActiveTab('schools')}
              onRouteToggle={() => {}}
            />
          )}
        </Sidebar>

        {/* Map */}
        <div style={{ flex: 1, position: 'relative', display: 'flex', flexDirection: 'column' }}>
          <AddressInput />
          <div style={{ flex: 1, position: 'relative' }}>
            {activeTab === 'schools' ? (
              // Schools map view - uses filtered schools
              <SchoolListMapView 
                schools={filteredSchools}
                selectedSchoolId={selectedSchoolId}
                onSelectSchool={(schoolId) => {
                  if (selectedSchoolId === schoolId) {
                    setSelectedSchool(null);
                  } else {
                    setSelectedSchool(schoolId);
                  }
                }}
                mapRef={mapRef}
              />
            ) : (
              <>
                <MapView />
                {isLoading && activeTab === 'routes' && selectedSchoolId && (
                  <div
                    style={{
                      position: 'absolute',
                      bottom: '1rem',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      zIndex: 1000,
                      padding: '0.75rem 1.5rem',
                      backgroundColor: 'var(--bg-primary)',
                      color: 'var(--text-primary)',
                      borderRadius: '12px',
                      boxShadow: '0 2px 8px var(--shadow-large)',
                      width: '200px',
                      pointerEvents: 'none', // Don't block map clicks
                    }}
                  >
                    <ProgressBar label="Loading routes..." />
                  </div>
                )}
              </>
            )}

            {/* Selected school info dialog - DEPRECATED, now using Tooltip in SchoolListMapView */}
          </div>
        </div>
      </div>

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

function AdminApp() {
  const { isLoading, loadingProgress, selectedSchoolId, setSelectedSchool, schools, setSchools, setRoutes, setLoading, setLoadingProgress, routes, directionFilter, selectedStop } = useStore();
  const isMobile = useIsMobile();
  const location = useLocation();
  const navigate = useNavigate();
  
  // Listen for tab change events
  useEffect(() => {
    const handleTabChangeEvent = (e: any) => {
      if (e.detail === 'routes' || e.detail === 'schools') {
        setActiveTab(e.detail);
      }
    };
    window.addEventListener('change-tab', handleTabChangeEvent);
    return () => window.removeEventListener('change-tab', handleTabChangeEvent);
  }, []);

  // Parse URL to determine initial active tab
  const urlState = parseUrlPath(location.pathname, '/admin');
  const [activeTab, setActiveTab] = useState<'schools' | 'routes'>(() => {
    return urlState.show || 'routes';
  });

  // Get selected routes, filtered by direction
  const selectedRoutes = useMemo(() => {
    return routes.filter(route => {
      if (!route.isSelected) return false;
      if (directionFilter === 'Both') return true;
      if (!route.direction) return true;
      return route.direction === directionFilter;
    });
  }, [routes, directionFilter]);

  // Wrapper to handle TabBar's expected type signature
  const handleTabChange = (tab: 'schools' | 'routes' | 'neighborhoods') => {
    if (tab === 'schools' || tab === 'routes') {
      setActiveTab(tab);
      // URL will be updated automatically by useUrlState hook
    }
  };
  const mapRef = useRef<L.Map | null>(null);
  const [schoolTypeFilters, setSchoolTypeFilters] = useState<SchoolTypeFilters>({
    elementary: true,
    middle: true,
    high: true,
    hybrid: true,
  });
  const [searchTerm, setSearchTerm] = useState('');
  
  // Load schools
  useEffect(() => {
    const loadSchools = async () => {
      try {
        console.log('[AdminApp] Loading all schools with stats...');
        const response = await fetch('/api/schools?includeStats=true&all=true');
        if (response.ok) {
          const data = await response.json();
          console.log('[AdminApp] Loaded', data.schools?.length || 0, 'schools');
          setSchools(data.schools || []);
        } else {
          console.error('[AdminApp] Failed to load schools:', response.status, response.statusText);
        }
      } catch (error) {
        console.error('[AdminApp] Error loading schools:', error);
      }
    };
    loadSchools();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Initialize URL state sync (only after schools are loaded)
  const { 
    cancelPendingUrlUpdate: cancelPendingUrlUpdateAdmin, 
    markRouteToggle: markRouteToggleAdmin
  } = useUrlState({
    basePath: '/admin',
    schools,
    routes,
    activeTab,
    setActiveTab,
    debounceMs: 300,
  });

  // Load routes when school changes (only when in routes tab)
  useEffect(() => {
    if (!selectedSchoolId || activeTab !== 'routes') {
      console.log('[AdminApp] No school selected or not in routes tab, skipping route load');
      if (activeTab !== 'routes') {
        setRoutes([]);
      }
      return;
    }

    console.log('[AdminApp] Loading routes for school:', selectedSchoolId);
    const loadRoutes = async () => {
      setLoading(true);
      setLoadingProgress(0);
      try {
        const loadedRoutes = await loadLocalRoutes(selectedSchoolId);
        
        // Pre-apply URL state to avoid UI flicker
        const urlState = parseUrlPath(window.location.pathname, '/admin');
        const syncedRoutes = applyUrlStateToRoutes(loadedRoutes, urlState, directionFilter);
        
        console.log('[AdminApp] Loaded', loadedRoutes.length, 'routes');
        setRoutes(syncedRoutes);
        setLoadingProgress(100);
      } catch (error) {
        console.error('[AdminApp] Failed to load routes:', error);
        setRoutes([]); // Set empty array on error
      } finally {
        setLoading(false);
        setLoadingProgress(null);
      }
    };

    loadRoutes();
  }, [selectedSchoolId, activeTab, setRoutes, setLoading]);

  // Filter schools based on search and type filters
  const filteredSchools = useMemo(() => {
    return schools.filter(school => {
      // Search filter
      const matchesSearch = 
        school.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (school.address && school.address.toLowerCase().includes(searchTerm.toLowerCase()));
      
      if (!matchesSearch) return false;
      
      // School type filter
      const schoolTypes = school.schoolTypes || getSchoolTypes(school.name);
      const isHybrid = schoolTypes.includes('Hybrid');
      
      // If it's a hybrid school, check hybrid filter
      if (isHybrid) {
        if (schoolTypeFilters.hybrid) {
          return true; // Show hybrid schools if hybrid filter is enabled
        }
        // If hybrid filter is disabled, don't show hybrid schools
        return false;
      }
      
      // For non-hybrid schools, check individual type filters
      const matchesFilter = 
        (schoolTypes.includes('Elementary School') && schoolTypeFilters.elementary) ||
        (schoolTypes.includes('Middle School') && schoolTypeFilters.middle) ||
        (schoolTypes.includes('High School') && schoolTypeFilters.high);
      
      return matchesFilter;
    });
  }, [schools, searchTerm, schoolTypeFilters]);

  // Geocoding is now done server-side when processing PDFs
  // Routes should already have coordinates loaded from processed JSON files
  // useGeocodeStops(); // DISABLED - no client-side geocoding needed

  // Prevent viewport shifting on mobile navigation/route selection
  useEffect(() => {
    if (isMobile) {
      // Reset any accidental window scroll that Safari might have performed
      window.scrollTo(0, 0);
      
      // Ensure body is locked to prevent background scrolling
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.width = '100%';
      document.body.style.height = '100%';
      
      return () => {
        document.body.style.overflow = '';
        document.body.style.position = '';
        document.body.style.width = '';
        document.body.style.height = '';
      };
    }
  }, [isMobile, location.pathname]);

  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      height: 'var(--app-height)', 
      width: '100vw',
      position: isMobile ? 'fixed' : 'relative',
      top: 0,
      left: 0,
      overflow: 'hidden'
    }}>
      <Header />
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Sidebar */}
        <Sidebar
          header={null}
          tabs={<TabBar activeTab={activeTab} onTabChange={handleTabChange} />}
          persistenceKey="sidebar-width-admin"
        >
          {activeTab === 'schools' ? (
            <SchoolList
              schools={schools}
              selectedSchoolId={selectedSchoolId}
              enableEditing={true}
              searchTerm={searchTerm}
              onSearchChange={setSearchTerm}
              schoolTypeFilters={schoolTypeFilters}
              onFiltersChange={setSchoolTypeFilters}
              onSelectSchool={(schoolId) => {
                if (selectedSchoolId === schoolId) {
                  setSelectedSchool(null);
                } else {
                  setSelectedSchool(schoolId);
                }
              }}
              onAddSchool={async (newSchool) => {
                try {
                  analyticsService.trackAdminAction('school_create', newSchool.name);
                  console.log('[AdminApp] Creating school:', newSchool);
                  const response = await fetch('/api/schools', {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(newSchool),
                  });

                  if (!response.ok) {
                    const error = await response.json();
                    throw new Error(error.error || 'Failed to create school');
                  }

                  const data = await response.json();
                  const createdSchool = data.school;

                  // Update schools in state
                  setSchools([...schools, createdSchool]);

                  console.log('[AdminApp] School created successfully');
                } catch (error: any) {
                  console.error('[AdminApp] Error creating school:', error);
                  alert(`Failed to create school: ${error.message}`);
                }
              }}
              onUpdateSchool={async (schoolId, updates) => {
                try {
                  analyticsService.trackAdminAction('school_update', schoolId);
                  console.log('[AdminApp] Updating school:', schoolId, updates);
                  const response = await fetch(`/api/schools/${schoolId}`, {
                    method: 'PUT',
                    headers: {
                      'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(updates),
                  });

                  if (!response.ok) {
                    const error = await response.json();
                    throw new Error(error.error || 'Failed to update school');
                  }

                  const data = await response.json();
                  const updatedSchool = data.school;

                  // Update schools in state
                  const updatedSchools = schools.map(s => 
                    s.id === schoolId ? { ...s, ...updatedSchool } : s
                  );
                  setSchools(updatedSchools);

                  console.log('[AdminApp] School updated successfully');
                } catch (error: any) {
                  console.error('[AdminApp] Error updating school:', error);
                  alert(`Failed to update school: ${error.message}`);
                }
              }}
            />
          ) : (
            <RouteList 
              showBothOption={true}
              onClearSchool={() => setActiveTab('schools')}
              onViewSchools={() => setActiveTab('schools')}
              onRouteToggle={() => {}}
            />
          )}
        </Sidebar>

        {/* Map */}
        <div style={{ flex: 1, position: 'relative', display: 'flex', flexDirection: 'column' }}>
          {activeTab === 'routes' && (
            <AddressLookup 
              onAddressSelect={(_address, _coordinates) => {
                // Address is already saved to store by AddressLookup component
                // This callback is still called but parameters are unused since MapView reads from store
              }}
            />
          )}
          <div style={{ flex: 1, position: 'relative' }}>
            {activeTab === 'schools' ? (
              // Schools map view - uses filtered schools
              <SchoolListMapView 
                schools={filteredSchools}
                selectedSchoolId={selectedSchoolId}
                onSelectSchool={(schoolId) => {
                  if (selectedSchoolId === schoolId) {
                    setSelectedSchool(null);
                  } else {
                    setSelectedSchool(schoolId);
                  }
                }}
                mapRef={mapRef}
              />
            ) : (
              <>
                <MapView 
                  editingMode={true} 
                  enableStreetHighlighting={true}
                  enableStreetPins={true}
                />
                {isLoading && activeTab === 'routes' && selectedSchoolId && (
                  <div
                    style={{
                      position: 'absolute',
                      bottom: '1rem',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      zIndex: 1000,
                      padding: '0.75rem 1.5rem',
                      backgroundColor: 'var(--bg-primary)',
                      color: 'var(--text-primary)',
                      borderRadius: '12px',
                      boxShadow: '0 2px 8px var(--shadow-large)',
                      width: '200px',
                      pointerEvents: 'none', // Don't block map clicks
                    }}
                  >
                    <ProgressBar 
                      label="Loading routes..." 
                      progress={loadingProgress ?? undefined}
                      showPercentage={loadingProgress !== null}
                    />
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

function App() {
  // Initialize Google Analytics 4
  useEffect(() => {
    const trackingId = import.meta.env.VITE_GA_TRACKING_ID;
    if (trackingId) {
      analyticsService.init(trackingId);
    }
  }, []);

  return (
    <HelmetProvider>
      <BrowserRouter>
        <AppContent />
      </BrowserRouter>
    </HelmetProvider>
  );
}

function AppContent() {
  // Track page views on route changes
  usePageTracking();

  return (
    <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/contact" element={<ContactPage />} />
        <Route path="/schools" element={<SchoolDirectory />} />
        <Route path="/neighborhood-directory" element={<NeighborhoodDirectory />} />
        {/* Path-based routing for bus route explorer - catch-all to handle all segments */}
        <Route path="/bus-route-explorer/*" element={<ExplorerApp />} />
        {/* Path-based routing for admin - catch-all to handle all segments */}
        <Route 
          path="/admin/*" 
          element={
            <AdminPasswordProtection>
              <AdminApp />
            </AdminPasswordProtection>
          } 
        />
        <Route 
          path="/neighborhoods" 
          element={
            <AdminPasswordProtection>
              <Neighborhoods />
            </AdminPasswordProtection>
          } 
        />
        <Route 
          path="/tech" 
          element={
            <AdminPasswordProtection>
              <TechPage />
            </AdminPasswordProtection>
          } 
        />
        <Route 
          path="/verification" 
          element={
            <AdminPasswordProtection>
              <VerificationPage />
            </AdminPasswordProtection>
          } 
        />
        <Route 
          path="/jobs" 
          element={
            <AdminPasswordProtection>
              <JobsPage />
            </AdminPasswordProtection>
          } 
        />
        <Route 
          path="/servers" 
          element={
            <AdminPasswordProtection>
              <ServersPage />
            </AdminPasswordProtection>
          } 
        />
        <Route 
          path="/architecture" 
          element={
            <AdminPasswordProtection>
              <ArchitecturePage />
            </AdminPasswordProtection>
          } 
        />
        {/* Deprecated: Schools List page - kept for backward compatibility but no longer linked */}
        <Route path="/data/schools" element={<SchoolsList />} />
      </Routes>
  );
}

export default App;
