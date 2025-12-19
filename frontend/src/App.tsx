import { useState, useEffect, useRef, useMemo } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { MapContainer, useMap } from 'react-leaflet';
import L from 'leaflet';
import { RouteList } from './components/RouteList';
import { MapView } from './components/MapView';
import { AddressInput } from './components/AddressInput';
import { AddressLookup } from './components/AddressLookup';
import { SchoolList } from './components/SchoolList';
import { TabBar } from './components/TabBar';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { DarkModeTileLayer } from './components/DarkModeTileLayer';
import { useStore } from './store/useStore';
import { SchoolsList } from './pages/SchoolsList';
import { Neighborhoods } from './pages/Neighborhoods';
import { TechPage } from './pages/TechPage';
import { VerificationPage } from './pages/VerificationPage';
import { JobsPage } from './pages/JobsPage';
import { HomePage } from './pages/HomePage';
import { ServersPage } from './pages/ServersPage';
import { ArchitecturePage } from './pages/ArchitecturePage';
import { School } from './types';
import { loadLocalRoutes } from './services/localRoutes';
import { getSchoolTypes, getSchoolColor, createSchoolIcon } from './utils/schoolUtils';
import { createDefaultMarkerIcon } from './utils/fontAwesomeIcons';
import { handleMapLinkClick } from './utils/mapLinks';
import { useMarkers, MarkerData } from './hooks/useMarkers';
import { SchoolTypeFilters } from './components/SchoolTypeFilter';
import { ProgressBar } from './components/ProgressBar';
import { AdminPasswordProtection } from './components/AdminPasswordProtection';
import { useIsMobile } from './hooks/useMediaQuery';
import { useUrlState } from './hooks/useUrlState';
import { parseUrlPath, applyUrlStateToRoutes } from './services/urlState';
import { useLocation, useNavigate } from 'react-router-dom';
import 'leaflet/dist/leaflet.css';

// Format date for display (e.g., "Dec 10, 2024" or "2 days ago")
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) {
    return 'today';
  } else if (diffDays === 1) {
    return 'yesterday';
  } else if (diffDays < 7) {
    return `${diffDays} days ago`;
  } else if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7);
    return `${weeks} ${weeks === 1 ? 'week' : 'weeks'} ago`;
  } else {
    // Format as "MMM DD, YYYY"
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }
}

// Set default marker icon to use Font Awesome
const defaultIcon = createDefaultMarkerIcon();
L.Marker.prototype.options.icon = defaultIcon;

// Component to manage school markers on map using useMarkers hook
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
  const schoolsWithCoords = schools.filter(s => s.coordinates && s.coordinates.length === 2);
  
  // Filter to only show selected school when one is selected
  const schoolsToShow = useMemo(() => {
    if (selectedSchoolId) {
      // Only show the selected school
      return schoolsWithCoords.filter(s => s.id === selectedSchoolId);
    }
    // Show all schools when none is selected
    return schoolsWithCoords;
  }, [schoolsWithCoords, selectedSchoolId]);
  
  const markerData: MarkerData[] = useMemo(() => {
    return schoolsToShow.map(school => {
      const schoolTypes = school.schoolTypes || getSchoolTypes(school.name);
      const schoolColor = getSchoolColor(schoolTypes);
      return {
        id: school.id,
        position: [school.coordinates![1], school.coordinates![0]] as [number, number],
        icon: createSchoolIcon(schoolColor),
        onClick: () => {
          if (selectedSchoolId === school.id) {
            onSelectSchool(null);
          } else {
            onSelectSchool(school.id);
          }
        },
      };
    });
  }, [schoolsToShow, selectedSchoolId, onSelectSchool]);

  if (schoolsWithCoords.length === 0) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100%',
        color: 'var(--text-tertiary)',
      }}>
        No schools with coordinates to display on map
      </div>
    );
  }

  return (
    <MapContainer
      key="schools-map"
      center={[45.5152, -122.6784]}
      zoom={12}
      style={{ height: '100%', width: '100%' }}
      ref={mapRef}
    >
      <DarkModeTileLayer />
      <FitSchoolBounds schools={schoolsWithCoords} selectedSchoolId={selectedSchoolId} />
      <SchoolMarkersManager markers={markerData} />
    </MapContainer>
  );
}

// Component that uses useMarkers hook
function SchoolMarkersManager({ markers }: { markers: MarkerData[] }) {
  useMarkers(markers, { debug: false });
  return null;
}

// Component to fit map bounds to show all schools
function FitSchoolBounds({ schools, selectedSchoolId }: { schools: School[]; selectedSchoolId: string | null }) {
  const map = useMap();
  const prevSelectedSchoolIdRef = useRef<string | null>(null);
  const isMobile = useIsMobile();
  
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
          
          // On mobile, shift the map up so the marker is visible above the dialog
          if (isMobile) {
            // Use setTimeout to ensure the view change completes before panning
            setTimeout(() => {
              // Shift map up by ~200px to account for the dialog at the bottom
              // The dialog has maxHeight: 70vh, so we shift up to make marker visible
              map.panBy([0, 200], { animate: true });
            }, 100);
          }
          
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
  }, [map, schools, selectedSchoolId, isMobile]);
  
  return null;
}

function ExplorerApp() {
  const { isLoading, selectedSchoolId, setSelectedSchool, schools, setSchools, setRoutes, setLoading, setLoadingProgress, routes, directionFilter, selectedStop } = useStore();
  const isMobile = useIsMobile();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [swipeStartY, setSwipeStartY] = useState<number | null>(null);
  const [swipeCurrentY, setSwipeCurrentY] = useState<number | null>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const [isSchoolDialogClosing, setIsSchoolDialogClosing] = useState<boolean>(false);
  
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
  
  // Wrapper to handle TabBar's expected type signature
  const handleTabChange = (tab: 'schools' | 'routes' | 'neighborhoods') => {
    if (tab === 'schools' || tab === 'routes') {
      setActiveTab(tab);
      // URL will be updated automatically by useUrlState hook
      // Sidebar stays open on mobile when switching tabs
    }
  };
  const [selectedSchoolForMap, setSelectedSchoolForMap] = useState<School | null>(null);
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
        console.log('[ExplorerApp] Loading schools...');
        const response = await fetch('/api/schools');
        if (response.ok) {
          const data = await response.json();
          console.log('[ExplorerApp] Loaded', data.schools?.length || 0, 'schools');
          setSchools(data.schools || []);
          // URL state hook will handle syncing from URL after schools are loaded
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

  // Update selectedSchoolForMap when selectedSchoolId changes
  useEffect(() => {
    if (selectedSchoolId && schools.length > 0) {
      // Only auto-show the dialog if we are in the schools tab
      // In the routes tab, the dialog should only show via explicit user interaction (e.g. clicking a school pin)
      if (activeTab === 'schools') {
        const school = schools.find(s => s.id === selectedSchoolId);
        if (school && selectedSchoolForMap?.id !== school.id) {
          setSelectedSchoolForMap(school);
        }
      }
    } else if (!selectedSchoolId) {
      setSelectedSchoolForMap(null);
    }
  }, [selectedSchoolId, schools, activeTab]);

  // Clear school dialog when a stop is selected
  useEffect(() => {
    if (selectedStop) {
      setSelectedSchoolForMap(null);
    }
  }, [selectedStop]);

  // Handle school dialog closing animation
  const handleCloseSchoolDialog = (preserveSchoolSelection = false) => {
    setIsSchoolDialogClosing(true);
    if (!preserveSchoolSelection) {
      // Cancel any pending debounced URL updates to prevent race conditions
      cancelPendingUrlUpdate();
      
      // Clear school selection ONLY if in schools tab
      if (activeTab === 'schools') {
        setSelectedSchool(null);
        navigate('/bus-route-explorer', { replace: true });
      }
      // If in routes tab, we keep the school selected so we don't lose the routes
    }
    setTimeout(() => {
      setSelectedSchoolForMap(null);
      setIsSchoolDialogClosing(false);
    }, 125); // Match animation duration
  };

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
        padding: '0.5rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '40px',
        height: '40px',
        borderRadius: '4px',
      }}
      aria-label={sidebarOpen ? "Close menu" : "Open menu"}
    >
      <HamburgerIcon isOpen={sidebarOpen} />
    </button>
  ) : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100vw' }}>
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
                <MapView 
                  onSchoolStopClick={(schoolId) => {
                    // When a school stop is clicked, show the school dialog
                    const school = schools.find(s => s.id === schoolId);
                    if (school) {
                      setSelectedSchoolForMap(school);
                    }
                  }}
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
                      borderRadius: '8px',
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

            {/* Selected school info dialog (shown for the currently selected school) */}
            {(selectedSchoolForMap || isSchoolDialogClosing) && (
              <div 
                ref={sheetRef}
                style={{
                  position: 'absolute',
                  ...(isMobile ? {
                    bottom: isSchoolDialogClosing 
                      ? '-100%' 
                      : swipeCurrentY !== null 
                        ? Math.min(0, swipeCurrentY - (swipeStartY || 0)) 
                        : 0,
                    left: 0,
                    right: 0,
                    maxWidth: '100%',
                    borderTopLeftRadius: '16px',
                    borderTopRightRadius: '16px',
                    borderBottomLeftRadius: 0,
                    borderBottomRightRadius: 0,
                    maxHeight: '70vh',
                    overflowY: swipeStartY === null ? 'auto' : 'hidden',
                    touchAction: 'pan-y',
                  } : {
                    bottom: '1rem',
                    right: '1rem',
                    maxWidth: '400px',
                    borderRadius: '8px',
                  }),
                  backgroundColor: 'var(--bg-primary)',
                  padding: '1.5rem',
                  boxShadow: '0 4px 12px var(--shadow-hover)',
                  zIndex: 1000,
                  transition: swipeStartY === null 
                    ? 'bottom 0.125s cubic-bezier(0.68, -0.15, 0.265, 1.15)' 
                    : 'none',
                  animation: isMobile && swipeStartY === null && !isSchoolDialogClosing 
                    ? 'slideUp 0.125s cubic-bezier(0.68, -0.15, 0.265, 1.15)' 
                    : undefined,
                }}
                onTouchStart={(e) => {
                  if (!isMobile) return;
                  const touch = e.touches[0];
                  setSwipeStartY(touch.clientY);
                  setSwipeCurrentY(touch.clientY);
                }}
                onTouchMove={(e) => {
                  if (!isMobile || swipeStartY === null) return;
                  const touch = e.touches[0];
                  // Only allow downward swipes
                  if (touch.clientY > swipeStartY) {
                    setSwipeCurrentY(touch.clientY);
                  }
                }}
                  onTouchEnd={() => {
                  if (!isMobile || swipeStartY === null) return;
                  const swipeDistance = swipeCurrentY! - swipeStartY;
                  // If swiped down more than 100px, close the sheet
                  if (swipeDistance > 100) {
                    handleCloseSchoolDialog();
                  }
                  // Reset swipe state
                  setSwipeStartY(null);
                  setSwipeCurrentY(null);
                }}
              >
                {/* Drag handle for mobile */}
                {isMobile && (
                  <div 
                    style={{
                      width: '40px',
                      height: '4px',
                      backgroundColor: 'var(--text-tertiary)',
                      borderRadius: '2px',
                      margin: '0 auto 1rem',
                      opacity: 0.5,
                      cursor: 'grab',
                      touchAction: 'none',
                    }}
                    onTouchStart={(e) => {
                      e.stopPropagation();
                      const touch = e.touches[0];
                      setSwipeStartY(touch.clientY);
                      setSwipeCurrentY(touch.clientY);
                    }}
                  />
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                  <div style={{ flex: 1 }}>
                    <h2 style={{ margin: 0, fontSize: '20px', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>{selectedSchoolForMap?.name}</h2>
                    {selectedSchoolForMap && (() => {
                      const schoolTypes = selectedSchoolForMap?.schoolTypes || getSchoolTypes(selectedSchoolForMap?.name || '');
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
                    onClick={() => handleCloseSchoolDialog()}
                    style={{
                      background: 'none',
                      border: 'none',
                      fontSize: '32px',
                      cursor: 'pointer',
                      color: 'var(--text-tertiary)',
                      padding: '0',
                      lineHeight: '1',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginTop: '2px',
                    }}
                  >
                    <ThinXIcon />
                  </button>
                </div>
                {selectedSchoolForMap?.routeCount !== undefined && (
                  <div style={{ marginBottom: '1.5rem' }}>
                    <div style={{ fontSize: '12px', color: '#666', marginBottom: '0.25rem' }}>Routes</div>
                    <div 
                      onClick={() => {
                        if (selectedSchoolForMap) {
                          setSelectedSchool(selectedSchoolForMap.id);
                          setActiveTab('routes');
                          handleCloseSchoolDialog(true); // Preserve school selection when switching to routes
                        }
                      }}
                      style={{ 
                        fontSize: '14px', 
                        color: 'var(--text-primary)', 
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
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                        <path d="M3 12h18M3 6h18M3 18h18"></path>
                        <circle cx="6" cy="12" r="2"></circle>
                        <circle cx="18" cy="12" r="2"></circle>
                      </svg>
                      <span>{selectedSchoolForMap?.routeCount} {selectedSchoolForMap?.routeCount === 1 ? 'route' : 'routes'} available</span>
                    </div>
                    {selectedSchoolForMap?.routesUpdatedAt && (
                      <div style={{ fontSize: '12px', color: '#666', marginTop: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <i className="fas fa-clock" style={{ fontSize: '12px', width: '12px', flexShrink: 0 }}></i>
                        <span>Updated {formatDate(selectedSchoolForMap.routesUpdatedAt)}</span>
                      </div>
                    )}
                  </div>
                )}
                {selectedSchoolForMap?.neighborhood && (
                  <div style={{ marginBottom: isMobile ? '2rem' : '1.5rem' }}>
                    <div style={{ fontSize: '12px', color: '#666', marginBottom: '0.25rem' }}>Neighborhood</div>
                    <div style={{ fontSize: '14px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <i className="fas fa-map-marker-alt" style={{ fontSize: '14px', color: 'var(--text-tertiary)' }}></i>
                      <span>{selectedSchoolForMap?.neighborhood}</span>
                    </div>
                  </div>
                )}
                {selectedSchoolForMap?.address && (
                  <div style={{ marginBottom: isMobile ? '2rem' : '1.5rem' }}>
                    <div style={{ fontSize: '12px', color: '#666', marginBottom: '0.25rem' }}>Address</div>
                    <a
                      href="#"
                      onClick={(e) => selectedSchoolForMap && handleMapLinkClick(e, selectedSchoolForMap.address!, selectedSchoolForMap.coordinates)}
                      style={{
                        fontSize: '14px',
                        color: 'var(--text-primary)',
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
                {(selectedSchoolForMap?.schoolPageLink || selectedSchoolForMap?.driveLink) && (
                  <div style={{ 
                    display: 'flex', 
                    gap: '1rem',
                    marginBottom: isMobile ? '2rem' : '1.5rem',
                    flexWrap: 'wrap',
                  }}>
                    {selectedSchoolForMap?.schoolPageLink && (
                      <a
                        href={selectedSchoolForMap.schoolPageLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          fontSize: '14px',
                          color: 'var(--text-primary)',
                          textDecoration: 'none',
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
                        <i className="fas fa-external-link-alt" style={{ fontSize: '12px', flexShrink: 0 }}></i>
                        <span>School Page</span>
                      </a>
                    )}
                    {selectedSchoolForMap?.driveLink && (
                      <a
                        href={selectedSchoolForMap.driveLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          fontSize: '14px',
                          color: 'var(--text-primary)',
                          textDecoration: 'none',
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
                        <i className="fas fa-folder" style={{ fontSize: '12px', flexShrink: 0 }}></i>
                        <span>Drive Folder</span>
                      </a>
                    )}
                  </div>
                )}
                {/* "View Routes" button - only show when not already on routes tab */}
                {selectedSchoolForMap?.routeCount !== undefined && activeTab !== 'routes' && (
                  <button
                    onClick={() => {
                      if (selectedSchoolForMap) {
                        // Set school and change tab together - React batches these updates
                        setSelectedSchool(selectedSchoolForMap.id);
                        setActiveTab('routes');
                        // Use clearSelectedStop from store if available
                        useStore.getState().clearSelectedStop();
                        handleCloseSchoolDialog(true); // Preserve school selection when switching to routes
                      }
                    }}
                    style={{
                      width: '100%',
                      padding: '1rem',
                      backgroundColor: '#133A60',
                      color: 'white',
                      border: 'none',
                      borderRadius: '9999px',
                      fontSize: '16px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      marginTop: '1rem',
                      transition: 'background-color 0.2s ease',
                      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#0f2d4a';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = '#133A60';
                    }}
                  >
                    View Routes
                  </button>
                )}
              </div>
            )}
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
  
  // Parse URL to determine initial active tab
  const urlState = parseUrlPath(location.pathname, '/admin');
  const [activeTab, setActiveTab] = useState<'schools' | 'routes'>(() => {
    return urlState.show || 'routes';
  });
  
  // Wrapper to handle TabBar's expected type signature
  const handleTabChange = (tab: 'schools' | 'routes' | 'neighborhoods') => {
    if (tab === 'schools' || tab === 'routes') {
      setActiveTab(tab);
      // URL will be updated automatically by useUrlState hook
    }
  };
  const [selectedSchoolForMap, setSelectedSchoolForMap] = useState<School | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const [isSchoolDialogClosing, setIsSchoolDialogClosing] = useState<boolean>(false);
  const [schoolTypeFilters, setSchoolTypeFilters] = useState<SchoolTypeFilters>({
    elementary: true,
    middle: true,
    high: true,
    hybrid: true,
  });
  const [searchTerm, setSearchTerm] = useState('');
  
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
      }}></span>
      <span style={{
        display: 'block',
        height: '1.5px',
        width: '100%',
        backgroundColor: 'currentColor',
        borderRadius: '2px',
        position: 'absolute',
        transform: 'rotate(-45deg)',
      }}></span>
    </div>
  );
  
  // Load schools
  useEffect(() => {
    const loadSchools = async () => {
      try {
        console.log('[AdminApp] Loading schools...');
        const response = await fetch('/api/schools');
        if (response.ok) {
          const data = await response.json();
          console.log('[AdminApp] Loaded', data.schools?.length || 0, 'schools');
          setSchools(data.schools || []);
          // URL state hook will handle syncing from URL after schools are loaded
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

  // Update selectedSchoolForMap when selectedSchoolId changes
  useEffect(() => {
    if (selectedSchoolId && schools.length > 0) {
      // Only auto-show the dialog if we are in the schools tab
      // In the routes tab, the dialog should only show via explicit user interaction (e.g. clicking a school pin)
      if (activeTab === 'schools') {
        const school = schools.find(s => s.id === selectedSchoolId);
        if (school && selectedSchoolForMap?.id !== school.id) {
          setSelectedSchoolForMap(school);
        }
      }
    } else if (!selectedSchoolId) {
      setSelectedSchoolForMap(null);
    }
  }, [selectedSchoolId, schools, activeTab]);

  // Clear school dialog when a stop is selected
  useEffect(() => {
    if (selectedStop) {
      setSelectedSchoolForMap(null);
    }
  }, [selectedStop]);

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

  // Handle school dialog closing animation
  const handleCloseSchoolDialog = (preserveSchoolSelection = false) => {
    setIsSchoolDialogClosing(true);
    if (!preserveSchoolSelection) {
      // Cancel any pending debounced URL updates to prevent race conditions
      cancelPendingUrlUpdateAdmin();
      
      // Clear school selection ONLY if in schools tab
      if (activeTab === 'schools') {
        setSelectedSchool(null);
        navigate('/admin', { replace: true });
      }
      // If in routes tab, we keep the school selected so we don't lose the routes
    }
    setTimeout(() => {
      setSelectedSchoolForMap(null);
      setIsSchoolDialogClosing(false);
    }, 125); // Match animation duration
  };

  // Geocoding is now done server-side when processing PDFs
  // Routes should already have coordinates loaded from processed JSON files
  // useGeocodeStops(); // DISABLED - no client-side geocoding needed

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100vw' }}>
      <Header />
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Sidebar */}
        <Sidebar
          header={null}
          tabs={<TabBar activeTab={activeTab} onTabChange={handleTabChange} />}
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
              onUpdateSchool={async (schoolId, updates) => {
                try {
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
                    s.id === schoolId ? updatedSchool : s
                  );
                  setSchools(updatedSchools);

                  // Update selectedSchoolForMap if this school is currently selected
                  if (selectedSchoolId === schoolId) {
                    setSelectedSchoolForMap(updatedSchool);
                  }

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
                  onSchoolStopClick={(schoolId) => {
                    // When a school stop is clicked, show the school dialog
                    const school = schools.find(s => s.id === schoolId);
                    if (school) {
                      setSelectedSchoolForMap(school);
                    }
                  }}
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
                      borderRadius: '8px',
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

            {/* Selected school info dialog (shown for the currently selected school) */}
            {(selectedSchoolForMap || isSchoolDialogClosing) && (
              <div style={{
                position: 'absolute',
                ...(isMobile ? {
                  bottom: isSchoolDialogClosing ? '-100%' : 0,
                  left: 0,
                  right: 0,
                  maxWidth: '100%',
                  borderTopLeftRadius: '16px',
                  borderTopRightRadius: '16px',
                  borderBottomLeftRadius: 0,
                  borderBottomRightRadius: 0,
                  maxHeight: '70vh',
                  overflowY: 'auto',
                  transition: 'bottom 0.125s cubic-bezier(0.68, -0.15, 0.265, 1.15)',
                } : {
                  bottom: '1rem',
                  right: '1rem',
                  maxWidth: '400px',
                  borderRadius: '8px',
                }),
                backgroundColor: 'var(--bg-primary)',
                padding: '1.5rem',
                boxShadow: '0 4px 12px var(--shadow-hover)',
                zIndex: 1000,
                animation: isMobile && !isSchoolDialogClosing ? 'slideUp 0.125s cubic-bezier(0.68, -0.15, 0.265, 1.15)' : undefined,
              }}>
                {/* Drag handle for mobile */}
                {isMobile && (
                  <div style={{
                    width: '40px',
                    height: '4px',
                    backgroundColor: 'var(--text-tertiary)',
                    borderRadius: '2px',
                    margin: '0 auto 1rem',
                    opacity: 0.5,
                  }} />
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                  <div style={{ flex: 1 }}>
                    <h2 style={{ margin: 0, fontSize: '20px', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>{selectedSchoolForMap?.name}</h2>
                    {selectedSchoolForMap && (() => {
                      const schoolTypes = selectedSchoolForMap?.schoolTypes || getSchoolTypes(selectedSchoolForMap?.name || '');
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
                    onClick={() => handleCloseSchoolDialog()}
                    style={{
                      background: 'none',
                      border: 'none',
                      fontSize: '32px',
                      cursor: 'pointer',
                      color: 'var(--text-tertiary)',
                      padding: '0',
                      lineHeight: '1',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginTop: '2px',
                    }}
                  >
                    <ThinXIcon />
                  </button>
                </div>
                {selectedSchoolForMap?.routeCount !== undefined && (
                  <div style={{ marginBottom: '1.5rem' }}>
                    <div style={{ fontSize: '12px', color: '#666', marginBottom: '0.25rem' }}>Routes</div>
                    <div 
                      onClick={() => {
                        if (selectedSchoolForMap) {
                          setSelectedSchool(selectedSchoolForMap.id);
                          setActiveTab('routes');
                          handleCloseSchoolDialog(true); // Preserve school selection when switching to routes
                        }
                      }}
                      style={{ 
                        fontSize: '14px', 
                        color: 'var(--text-primary)', 
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
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                        <path d="M3 12h18M3 6h18M3 18h18"></path>
                        <circle cx="6" cy="12" r="2"></circle>
                        <circle cx="18" cy="12" r="2"></circle>
                      </svg>
                      <span>{selectedSchoolForMap?.routeCount} {selectedSchoolForMap?.routeCount === 1 ? 'route' : 'routes'} available</span>
                    </div>
                    {selectedSchoolForMap?.routesUpdatedAt && (
                      <div style={{ fontSize: '12px', color: '#666', marginTop: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <i className="fas fa-clock" style={{ fontSize: '12px', width: '12px', flexShrink: 0 }}></i>
                        <span>Updated {formatDate(selectedSchoolForMap.routesUpdatedAt)}</span>
                      </div>
                    )}
                  </div>
                )}
                {selectedSchoolForMap?.neighborhood && (
                  <div style={{ marginBottom: '1.5rem' }}>
                    <div style={{ fontSize: '12px', color: '#666', marginBottom: '0.25rem' }}>Neighborhood</div>
                    <div style={{ fontSize: '14px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <i className="fas fa-map-marker-alt" style={{ fontSize: '14px', color: 'var(--text-tertiary)' }}></i>
                      <span>{selectedSchoolForMap?.neighborhood}</span>
                    </div>
                  </div>
                )}
                {selectedSchoolForMap?.address && (
                  <div style={{ marginBottom: '1.5rem' }}>
                    <div style={{ fontSize: '12px', color: '#666', marginBottom: '0.25rem' }}>Address</div>
                    <a
                      href="#"
                      onClick={(e) => selectedSchoolForMap && handleMapLinkClick(e, selectedSchoolForMap.address!, selectedSchoolForMap.coordinates)}
                      style={{
                        fontSize: '14px',
                        color: 'var(--text-primary)',
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
                      <span>{selectedSchoolForMap?.address}</span>
                    </a>
                  </div>
                )}
                {(selectedSchoolForMap?.schoolPageLink || selectedSchoolForMap?.driveLink) && (
                  <div style={{ 
                    display: 'flex', 
                    gap: '1rem',
                    marginBottom: isMobile ? '2rem' : '1.5rem',
                    flexWrap: 'wrap',
                  }}>
                    {selectedSchoolForMap?.schoolPageLink && (
                      <a
                        href={selectedSchoolForMap.schoolPageLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          fontSize: '14px',
                          color: 'var(--text-primary)',
                          textDecoration: 'none',
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
                        <i className="fas fa-external-link-alt" style={{ fontSize: '12px', flexShrink: 0 }}></i>
                        <span>School Page</span>
                      </a>
                    )}
                    {selectedSchoolForMap?.driveLink && (
                      <a
                        href={selectedSchoolForMap.driveLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          fontSize: '14px',
                          color: 'var(--text-primary)',
                          textDecoration: 'none',
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
                        <i className="fas fa-folder" style={{ fontSize: '12px', flexShrink: 0 }}></i>
                        <span>Drive Folder</span>
                      </a>
                    )}
                  </div>
                )}
                {/* "View Routes" button - only show when not already on routes tab */}
                {selectedSchoolForMap?.routeCount !== undefined && activeTab !== 'routes' && (
                  <button
                    onClick={() => {
                      if (selectedSchoolForMap) {
                        // Set school and change tab together - React batches these updates
                        setSelectedSchool(selectedSchoolForMap.id);
                        setActiveTab('routes');
                        // Use clearSelectedStop from store if available
                        useStore.getState().clearSelectedStop();
                        handleCloseSchoolDialog(true); // Preserve school selection when switching to routes
                      }
                    }}
                    style={{
                      width: '100%',
                      padding: '1rem',
                      backgroundColor: '#133A60',
                      color: 'white',
                      border: 'none',
                      borderRadius: '9999px',
                      fontSize: '16px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      marginTop: '1rem',
                      transition: 'background-color 0.2s ease',
                      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#0f2d4a';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = '#133A60';
                    }}
                  >
                    View Routes
                  </button>
                )}
              </div>
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
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
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
        <Route path="/neighborhoods" element={<Neighborhoods />} />
        <Route path="/tech" element={<TechPage />} />
        <Route path="/verification" element={<VerificationPage />} />
        <Route path="/jobs" element={<JobsPage />} />
        <Route path="/servers" element={<ServersPage />} />
        <Route path="/architecture" element={<ArchitecturePage />} />
        {/* Deprecated: Schools List page - kept for backward compatibility but no longer linked */}
        <Route path="/data/schools" element={<SchoolsList />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
