import { useState, useEffect, useRef, useMemo } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
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
import { DataPage } from './pages/DataPage';
import { JobsPage } from './pages/JobsPage';
import { HomePage } from './pages/HomePage';
import { AboutPage } from './pages/AboutPage';
import { ContactPage } from './pages/ContactPage';
import { ServersPage } from './pages/ServersPage';
import { ArchitecturePage } from './pages/ArchitecturePage';
import { SyncDashboardPage } from './pages/SyncDashboardPage';
import { DesignSystemPage } from './pages/DesignSystemPage';
import LogoTestPage from './pages/LogoTestPage';
import { School, Route as BusRoute } from './types';
import { loadLocalRoutes } from './services/localRoutes';
import { getSchoolTypes, getSchoolColor, createSchoolIcon } from './utils/schoolUtils';
import { formatDate } from './utils/dateUtils';
import { createDefaultMarkerIcon, createHomeIcon } from './utils/fontAwesomeIcons';
import { handleMapLinkClick } from './utils/mapLinks';
import { SchoolTypeFilters } from './components/SchoolTypeFilter';
import { ProgressBar } from './components/ProgressBar';
import { AdminPasswordProtection } from './components/AdminPasswordProtection';
import { SchoolClosestModal } from './components/SchoolClosestModal';
import { useIsMobile } from './hooks/useMediaQuery';
import { useUrlState } from './hooks/useUrlState';
import { usePageTracking } from './hooks/usePageTracking';
import { analyticsService } from './services/analytics';
import { parseUrlPath, applyUrlStateToRoutes, type UrlState } from './services/urlState';
import { useLocation, useNavigate } from 'react-router-dom';
import 'leaflet/dist/leaflet.css';

// Set default marker icon to use Font Awesome
const defaultIcon = createDefaultMarkerIcon();
L.Marker.prototype.options.icon = defaultIcon;

// Custom Hamburger/Close icon component for animation
const HamburgerIcon = ({ isOpen, isMobile }: { isOpen: boolean; isMobile: boolean }) => (
  <div style={{
    width: isMobile ? '20px' : '22px',
    height: '20px',
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
      backgroundColor: 'var(--text-primary)',
      borderRadius: '2px',
      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      position: 'absolute',
      transform: isOpen ? 'rotate(45deg)' : 'translateY(-6px)',
      transformOrigin: 'center',
    }} />
    <span style={{
      display: 'block',
      height: '1.5px',
      width: '100%',
      backgroundColor: 'var(--text-primary)',
      borderRadius: '2px',
      transition: 'opacity 0.1s cubic-bezier(0.4, 0, 0.2, 1)',
      opacity: isOpen ? 0 : 1,
    }} />
    <span style={{
      display: 'block',
      height: '1.5px',
      width: '100%',
      backgroundColor: 'var(--text-primary)',
      borderRadius: '2px',
      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      position: 'absolute',
      transform: isOpen ? 'rotate(-45deg)' : 'translateY(6px)',
      transformOrigin: 'center',
    }} />
  </div>
);

// Header, Sidebar, and Map unification logic
export function ExplorerApp() {
  console.log('[ExplorerApp] Rendering...');
  const {
    isLoading,
    schools,
    setSchools,
    setRoutes,
    clearRoutes,
    setLoading,
    setLoadingProgress,
    routes,
  } = useStore();

  const isMobile = useIsMobile();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Use URL as source of truth for selection
  const {
    schoolId,
    activeTab,
    directionFilter,
    selectedRouteNames,
    selectedStopId,
    setSelectedSchool,
    setActiveTab,
    selectStop,
    viewSchoolRoutes,
  } = useUrlState({ basePath: '' });

  // Listen for tab change events from other components (if any)
  useEffect(() => {
    const handleTabChangeEvent = (e: any) => {
      if (e.detail === 'routes' || e.detail === 'schools') {
        setActiveTab(e.detail);
      }
    };
    window.addEventListener('change-tab', handleTabChangeEvent);
    return () => window.removeEventListener('change-tab', handleTabChangeEvent);
  }, [setActiveTab]);

  const [schoolTypeFilters, setSchoolTypeFilters] = useState<SchoolTypeFilters>({
    elementary: true, middle: true, high: true, hybrid: true, noRoutes: true,
  });
  const [searchTerm, setSearchTerm] = useState('');

  // Filter schools based on search and type filters
  const filteredSchools = useMemo(() => {
    return schools.filter(school => {
      const matchesSearch =
        school.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (school.address && school.address.toLowerCase().includes(searchTerm.toLowerCase()));
      if (!matchesSearch) return false;
      const schoolTypes = school.schoolTypes || getSchoolTypes(school.name);
      const isHybrid = schoolTypes.includes('Hybrid');
      const hasNoRoutes = school.routeCount === 0;

      // 1. Check School Type Filter first (PRIORITY)
      let matchesType = false;
      if (isHybrid) {
        matchesType = schoolTypeFilters.hybrid;
      } else {
        matchesType = (schoolTypes.includes('Elementary School') && schoolTypeFilters.elementary) ||
          (schoolTypes.includes('Middle School') && schoolTypeFilters.middle) ||
          (schoolTypes.includes('High School') && schoolTypeFilters.high);
      }

      if (!matchesType) return false;

      // 2. Then check Route Status Filter
      if (hasNoRoutes && !schoolTypeFilters.noRoutes) {
        return false;
      }

      return true;
    });
  }, [schools, searchTerm, schoolTypeFilters]);

  // Load schools
  useEffect(() => {
    const loadSchools = async () => {
      setLoading(true);
      try {
        const response = await fetch('/api/schools?includeStats=true');
        if (response.ok) {
          const data = await response.json();
          setSchools(data.schools || []);
        }
      } catch (error) {
        console.error('[ExplorerApp] Error loading schools:', error);
      } finally {
        setLoading(false);
      }
    };
    loadSchools();
  }, [setSchools, setLoading]);

  useEffect(() => {
    console.log('[ExplorerApp] schoolId from URL changed:', schoolId);
    if (!schoolId) {
      clearRoutes();
      return;
    }
    const loadRoutes = async () => {
      console.log('[ExplorerApp] Fetching routes for:', schoolId);
      setLoading(true);
      clearRoutes(); // Clear immediately to avoid using previous school's routes
      setLoadingProgress(0);
      try {
        const loadedRoutes = await loadLocalRoutes(schoolId);
        console.log('[ExplorerApp] Loaded routes:', loadedRoutes.length);
        setRoutes(loadedRoutes, schoolId);
        setLoadingProgress(100);
      } catch (error) {
        console.error('[ExplorerApp] Failed to load routes:', error);
        clearRoutes();
      } finally {
        setLoading(false);
        setLoadingProgress(null);
      }
    };
    loadRoutes();
  }, [schoolId, setRoutes, clearRoutes, setLoading, setLoadingProgress]);

  // Hamburger button
  const hamburgerButton = isMobile ? (
    <button onClick={() => setSidebarOpen(!sidebarOpen)} style={{
      background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-primary)',
      padding: isMobile ? '0.5rem 10px' : '0.5rem 13px', display: 'flex', alignItems: 'center', justifyContent: 'center',
      width: isMobile ? '44px' : '40px', height: '40px', borderRadius: '9999px',
    }} aria-label={sidebarOpen ? "Close menu" : "Open menu"}>
      <HamburgerIcon isOpen={sidebarOpen} isMobile={isMobile} />
    </button>
  ) : null;

  const handleTabChange = (tab: 'schools' | 'routes' | 'neighborhoods') => {
    setActiveTab(tab);
  };

  const selectedRoutes = useMemo(() => {
    return routes.filter(r => selectedRouteNames.includes(r.name) &&
      (directionFilter === 'Both' || r.direction === directionFilter));
  }, [routes, selectedRouteNames, directionFilter]);

  const selectedStop = useMemo(() => {
    if (!selectedStopId) return null;
    // Find stop in selected routes
    for (const route of routes) {
      const stopIndex = route.stops.findIndex(s => s.id === selectedStopId || `${route.name}-${s.id.replace('stop-', '')}` === selectedStopId);
      if (stopIndex !== -1) {
        return {
          route,
          stop: route.stops[stopIndex],
          stopNumber: stopIndex + 1
        };
      }
    }
    return null;
  }, [routes, selectedStopId]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'var(--app-height)', width: '100vw', position: isMobile ? 'fixed' : 'relative', top: 0, left: 0, overflow: 'hidden' }}>
      <SEO school={schools.find(s => s.id === schoolId)} selectedRoutes={selectedRoutes} selectedStop={selectedStop} />
      <Header rightContent={<div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>{hamburgerButton}</div>} />
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <Sidebar header={null} tabs={<TabBar activeTab={activeTab} onTabChange={handleTabChange} />} isOpen={!isMobile || sidebarOpen} onClose={() => setSidebarOpen(false)} persistenceKey="sidebar-width-explorer">
          {activeTab === 'schools' ? (
            <SchoolList
              schools={schools}
              selectedSchoolId={schoolId}
              searchTerm={searchTerm}
              onSearchChange={setSearchTerm}
              schoolTypeFilters={schoolTypeFilters}
              onFiltersChange={setSchoolTypeFilters}
              onSelectSchool={(id) => {
                if (isMobile && id) {
                  viewSchoolRoutes(id);
                  setSidebarOpen(false);
                } else {
                  setSelectedSchool(id);
                }
              }}
              onMobileClose={() => setSidebarOpen(false)}
            />
          ) : activeTab === 'neighborhoods' ? (
            <div style={{ padding: '1rem', color: 'var(--text-secondary)' }}>Neighborhoods coming soon...</div>
          ) : (
            <RouteList showBothOption={false} onClearSchool={() => setSelectedSchool(null)} onViewSchools={() => setActiveTab('schools')} />
          )}
        </Sidebar>

        <div style={{ flex: 1, position: 'relative', display: 'flex', flexDirection: 'column' }}>
          <AddressInput />
          <div style={{ flex: 1, position: 'relative' }}>
            <MapView
              viewMode={activeTab as 'schools' | 'routes'}
              onSelectSchool={setSelectedSchool}
              schools={filteredSchools}
            />

            {/* Overlay for mobile when no school is selected on routes tab */}
            {isMobile && activeTab === 'routes' && !schoolId && (
              <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 1000, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '1rem', textAlign: 'center', width: 'calc(100% - 2rem)', maxWidth: '320px' }}>
                <div style={{ backgroundColor: 'var(--bg-primary)', borderRadius: '16px', padding: '2rem 1.5rem', boxShadow: '0 4px 16px var(--shadow-large)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.25rem', width: '100%', border: '1px solid var(--border-color)' }}>
                  <i className="fas fa-graduation-cap" style={{ fontSize: '48px', color: 'var(--text-tertiary)', opacity: 0.6 }} />
                  <p style={{ fontSize: '16px', fontWeight: '500', margin: 0, color: 'var(--text-secondary)', lineHeight: '1.4' }}>Please select a school to view routes</p>
                  <button onClick={() => { setSelectedSchool(null); if (isMobile) setSidebarOpen(true); }} style={{ padding: '0.875rem 1.5rem', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: '9999px', cursor: 'pointer', fontSize: '14px', fontWeight: '500', width: '100%' }}>View Schools</button>
                </div>
              </div>
            )}

            {/* Loading Indicator for Schools */}
            {isLoading && schools.length === 0 && (
              <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 1000, padding: '1.5rem', backgroundColor: 'var(--bg-primary)', borderRadius: '12px', boxShadow: '0 4px 12px var(--shadow-large)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                <div style={{ width: '40px', height: '40px', border: '3px solid var(--border-color)', borderTopColor: 'var(--text-primary)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                <div style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Loading schools...</div>
              </div>
            )}

            {/* Loading Indicator for Routes */}
            {isLoading && activeTab === 'routes' && schoolId && (
              <div style={{ position: 'absolute', bottom: '1rem', left: '50%', transform: 'translateX(-50%)', zIndex: 1000, padding: '0.75rem 1.5rem', backgroundColor: 'var(--bg-primary)', borderRadius: '12px', boxShadow: '0 2px 8px var(--shadow-large)', width: '200px' }}>
                <ProgressBar label="Loading routes..." />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function AdminApp() {
  const {
    isLoading,
    loadingProgress,
    schools,
    setSchools,
    setRoutes,
    clearRoutes,
    setLoading,
    setLoadingProgress,
    routes,
  } = useStore();

  const isMobile = useIsMobile();
  const location = useLocation();
  const navigate = useNavigate();

  // Use URL as source of truth for selection
  const {
    schoolId,
    activeTab,
    directionFilter,
    selectedRouteNames,
    selectedStopId,
    setSelectedSchool,
    setActiveTab,
    viewSchoolRoutes,
  } = useUrlState({ basePath: '/admin' });

  // Listen for tab change events
  useEffect(() => {
    const handleTabChangeEvent = (e: any) => {
      if (e.detail === 'routes' || e.detail === 'schools') {
        setActiveTab(e.detail);
      }
    };
    window.addEventListener('change-tab', handleTabChangeEvent);
    return () => window.removeEventListener('change-tab', handleTabChangeEvent);
  }, [setActiveTab]);

  const [schoolTypeFilters, setSchoolTypeFilters] = useState<SchoolTypeFilters>({
    elementary: true, middle: true, high: true, hybrid: true, noRoutes: true,
  });
  const [searchTerm, setSearchTerm] = useState('');

  const handleTabChange = (tab: 'schools' | 'routes' | 'neighborhoods') => {
    setActiveTab(tab);
  };

  // Load schools
  useEffect(() => {
    const loadSchools = async () => {
      setLoading(true);
      try {
        const response = await fetch('/api/schools?includeStats=true&all=true');
        if (response.ok) {
          const data = await response.json();
          setSchools(data.schools || []);
        }
      } catch (error) {
        console.error('[AdminApp] Error loading schools:', error);
      } finally {
        setLoading(false);
      }
    };
    loadSchools();
  }, [setSchools, setLoading]);

  // Filter schools based on search and type filters
  const filteredSchools = useMemo(() => {
    return schools.filter(school => {
      const matchesSearch =
        school.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (school.address && school.address.toLowerCase().includes(searchTerm.toLowerCase()));
      if (!matchesSearch) return false;
      const schoolTypes = school.schoolTypes || getSchoolTypes(school.name);
      const isHybrid = schoolTypes.includes('Hybrid');
      const hasNoRoutes = school.routeCount === 0;

      // 1. Check School Type Filter first (PRIORITY)
      let matchesType = false;
      if (isHybrid) {
        matchesType = schoolTypeFilters.hybrid;
      } else {
        matchesType = (schoolTypes.includes('Elementary School') && schoolTypeFilters.elementary) ||
          (schoolTypes.includes('Middle School') && schoolTypeFilters.middle) ||
          (schoolTypes.includes('High School') && schoolTypeFilters.high);
      }

      if (!matchesType) return false;

      // 2. Then check Route Status Filter
      if (hasNoRoutes && !schoolTypeFilters.noRoutes) {
        return false;
      }

      return true;
    });
  }, [schools, searchTerm, schoolTypeFilters]);

  useEffect(() => {
    if (!schoolId) {
      clearRoutes();
      return;
    }
    const loadRoutes = async () => {
      setLoading(true);
      clearRoutes(); // Clear immediately to avoid using previous school's routes
      setLoadingProgress(0);
      try {
        const loadedRoutes = await loadLocalRoutes(schoolId);
        setRoutes(loadedRoutes, schoolId);
        setLoadingProgress(100);
      } catch (error) {
        console.error('[AdminApp] Failed to load routes:', error);
        clearRoutes();
      } finally {
        setLoading(false);
        setLoadingProgress(null);
      }
    };
    loadRoutes();
  }, [schoolId, setRoutes, clearRoutes, setLoading, setLoadingProgress]);

  const selectedRoutes = useMemo(() => {
    return routes.filter(r => selectedRouteNames.includes(r.name) &&
      (directionFilter === 'Both' || r.direction === directionFilter));
  }, [routes, selectedRouteNames, directionFilter]);

  const selectedStop = useMemo(() => {
    if (!selectedStopId) return null;
    for (const route of routes) {
      const stopIndex = route.stops.findIndex(s => s.id === selectedStopId || `${route.name}-${s.id.replace('stop-', '')}` === selectedStopId);
      if (stopIndex !== -1) {
        return {
          route,
          stop: route.stops[stopIndex],
          stopNumber: stopIndex + 1
        };
      }
    }
    return null;
  }, [routes, selectedStopId]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'var(--app-height)', width: '100vw', position: isMobile ? 'fixed' : 'relative', top: 0, left: 0, overflow: 'hidden' }}>
      <SEO school={schools.find(s => s.id === schoolId)} selectedRoutes={selectedRoutes} selectedStop={selectedStop} />
      <Header />
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <Sidebar header={null} tabs={<TabBar activeTab={activeTab} onTabChange={handleTabChange} />} persistenceKey="sidebar-width-admin">
          {activeTab === 'schools' ? (
            <SchoolList
              schools={schools}
              selectedSchoolId={schoolId}
              searchTerm={searchTerm}
              onSearchChange={setSearchTerm}
              schoolTypeFilters={schoolTypeFilters}
              onFiltersChange={setSchoolTypeFilters}
              onSelectSchool={(id) => {
                if (isMobile && id) {
                  viewSchoolRoutes(id);
                } else {
                  setSelectedSchool(id);
                }
              }}
            />
          ) : activeTab === 'neighborhoods' ? (
            <div style={{ padding: '1rem', color: 'var(--text-secondary)' }}>Neighborhoods coming soon...</div>
          ) : (
            <RouteList showBothOption={true} onClearSchool={() => setSelectedSchool(null)} onViewSchools={() => setActiveTab('schools')} />
          )}
        </Sidebar>

        <div style={{ flex: 1, position: 'relative', display: 'flex', flexDirection: 'column' }}>
          <AddressLookup onAddressSelect={() => { }} />
          <div style={{ flex: 1, position: 'relative' }}>
            <MapView
              viewMode={activeTab as 'schools' | 'routes'}
              editingMode={true}
              enableStreetHighlighting={true}
              enableStreetPins={true}
              onSelectSchool={setSelectedSchool}
              schools={filteredSchools}
            />

            {/* Loading Indicator */}
            {isLoading && activeTab === 'routes' && schoolId && (
              <div style={{ position: 'absolute', bottom: '1rem', left: '50%', transform: 'translateX(-50%)', zIndex: 1000, padding: '0.75rem 1.5rem', backgroundColor: 'var(--bg-primary)', borderRadius: '12px', boxShadow: '0 2px 8px var(--shadow-large)', width: '200px' }}>
                <ProgressBar label="Loading routes..." progress={loadingProgress ?? undefined} showPercentage={loadingProgress !== null} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function App() {
  const initializeStore = useStore(state => state.initialize);
  const isDarkMode = useStore(state => state.isDarkMode);

  // Apply dark mode class to document root
  useEffect(() => {
    console.log('[App] Dark mode changed:', isDarkMode);

    // Update body classes
    if (isDarkMode) {
      document.documentElement.classList.add('dark-mode');
      document.body.classList.add('dark-mode');
    } else {
      document.documentElement.classList.remove('dark-mode');
      document.body.classList.remove('dark-mode');
    }

    // Update theme-color meta tag for Safari address bar
    const themeColor = isDarkMode ? '#3A3A3A' : '#ffffff';
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
      metaThemeColor.setAttribute('content', themeColor);
    }

    // Update analytics user property
    analyticsService.setUserProperty('theme', isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

  // Initialize store and analytics
  useEffect(() => {
    console.log('[App] Initializing store...');

    // Don't restore school selection if on a clean explorer path
    const isCleanPath = window.location.pathname === '/schools' ||
      window.location.pathname === '/explore' ||
      window.location.pathname === '/';

    initializeStore({ skipSchoolSelection: isCleanPath });

    const trackingId = import.meta.env.VITE_GA_TRACKING_ID;
    if (trackingId) {
      analyticsService.init(trackingId);
      analyticsService.setUserProperty('theme', isDarkMode ? 'dark' : 'light');

      // Check for internal user flag in URL or LocalStorage
      const searchParams = new URLSearchParams(window.location.search);
      const isInternalUrl = searchParams.get('internal') === 'true';
      if (isInternalUrl) {
        localStorage.setItem('is_internal_user', 'true');
        console.log('[App] Marked as internal user');
      }

      const isInternalUser = localStorage.getItem('is_internal_user') === 'true';
      if (isInternalUser) {
        analyticsService.setUserProperty('traffic_type', 'internal');
      } else {
        analyticsService.setUserProperty('traffic_type', 'external');
      }

      const persona = window.location.pathname.startsWith('/admin') ? 'admin' : 'public';
      analyticsService.setUserProperty('user_persona', persona);
      analyticsService.setUserProperty('is_mobile', /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent));
    }
  }, [initializeStore, isDarkMode]);

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
    <>
      <SchoolClosestModal />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/contact" element={<ContactPage />} />
        <Route path="/school-directory" element={<SchoolDirectory />} />
        <Route path="/neighborhood-directory" element={<NeighborhoodDirectory />} />
        <Route path="/design-system" element={<DesignSystemPage />} />
        <Route path="/logo-test" element={<LogoTestPage />} />

        {/* Redirects for legacy routes */}
        <Route path="/schools-directory" element={<Navigate to="/school-directory" replace />} />
        <Route path="/bus-route-explorer" element={<Navigate to="/explore" replace />} />

        {/* Admin and system routes */}
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
        <Route path="/data" element={<DataPage />} />
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
        <Route
          path="/sync"
          element={
            <AdminPasswordProtection>
              <SyncDashboardPage />
            </AdminPasswordProtection>
          }
        />
        <Route path="/data/schools" element={<SchoolsList />} />

        {/* Path-based routing for admin - catch-all to handle all segments */}
        <Route
          path="/admin/*"
          element={
            <AdminPasswordProtection>
              <AdminApp />
            </AdminPasswordProtection>
          }
        />

        {/* Explorer Map (Catch-all handles both /schools, /explore, and /{schoolId}) */}
        <Route path="/schools" element={<ExplorerApp />} />
        <Route path="/explore" element={<ExplorerApp />} />
        <Route path="/*" element={<ExplorerApp />} />
      </Routes>
    </>
  );
}

export default App;
