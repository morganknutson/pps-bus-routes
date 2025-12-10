import { useState, useEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { MapContainer, Marker, Popup, useMap } from 'react-leaflet';
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
import { DataManagement } from './pages/DataManagement';
import { SchoolsList } from './pages/SchoolsList';
import { NeighborhoodExplorer } from './pages/NeighborhoodExplorer';
import { TechPage } from './pages/TechPage';
import { School } from './types';
import { loadLocalRoutes } from './services/localRoutes';
import { getSchoolTypes, getSchoolColor, createSchoolIcon } from './utils/schoolUtils';
import { createDefaultMarkerIcon } from './utils/fontAwesomeIcons';
import { handleMapLinkClick } from './utils/mapLinks';
import 'leaflet/dist/leaflet.css';

// Set default marker icon to use Font Awesome
const defaultIcon = createDefaultMarkerIcon();
L.Marker.prototype.options.icon = defaultIcon;

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

function MainApp() {
  const { isLoading, selectedSchoolId, setSelectedSchool, schools, setSchools, setRoutes, setLoading } = useStore();
  const [activeTab, setActiveTab] = useState<'schools' | 'routes'>('routes');
  const [selectedSchoolForMap, setSelectedSchoolForMap] = useState<School | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  
  // Load schools
  useEffect(() => {
    const loadSchools = async () => {
      try {
        const response = await fetch('/api/schools');
        if (response.ok) {
          const data = await response.json();
          setSchools(data.schools || []);
          // If no school is selected but schools exist, select the first one
          if (!selectedSchoolId && data.schools && data.schools.length > 0) {
            const westSylvan = data.schools.find((s: School) => s.id === 'west-sylvan');
            setSelectedSchool(westSylvan ? westSylvan.id : data.schools[0].id);
          }
        }
      } catch (error) {
        console.error('Error loading schools:', error);
      }
    };
    loadSchools();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load routes when school changes (only when in routes tab)
  useEffect(() => {
    if (!selectedSchoolId || activeTab !== 'routes') {
      console.log('[MainApp] No school selected or not in routes tab, skipping route load');
      if (activeTab !== 'routes') {
        setRoutes([]);
      }
      return;
    }

    console.log('[MainApp] Loading routes for school:', selectedSchoolId);
    const loadRoutes = async () => {
      setLoading(true);
      try {
        const routes = await loadLocalRoutes(selectedSchoolId);
        console.log('[MainApp] Loaded', routes.length, 'routes');
        setRoutes(routes);
      } catch (error) {
        console.error('[MainApp] Failed to load routes:', error);
        setRoutes([]); // Set empty array on error
      } finally {
        setLoading(false);
      }
    };

    loadRoutes();
  }, [selectedSchoolId, activeTab, setRoutes, setLoading]);


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
          tabs={<TabBar activeTab={activeTab} onTabChange={setActiveTab} />}
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
            />
          ) : (
            <RouteList 
              showBothOption={false}
              onClearSchool={() => setActiveTab('schools')}
            />
          )}
        </Sidebar>

        {/* Map */}
        <div style={{ flex: 1, position: 'relative', display: 'flex', flexDirection: 'column' }}>
          {activeTab === 'routes' && <AddressInput />}
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
                    <DarkModeTileLayer />
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
                        >
                          <Popup>{school.name}</Popup>
                        </Marker>
                      );
                    })}
                  </MapContainer>
                ) : (
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
              })()
            ) : (
              <>
                {isLoading && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '1rem',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      zIndex: 1000,
                      padding: '0.75rem 1.5rem',
                      backgroundColor: 'var(--bg-primary)',
                      color: 'var(--text-primary)',
                      borderRadius: '8px',
                      boxShadow: '0 2px 8px var(--shadow-large)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                    }}
                  >
                    <div
                      style={{
                        width: '16px',
                        height: '16px',
                        border: '2px solid #4ECDC4',
                        borderTopColor: 'transparent',
                        borderRadius: '50%',
                        animation: 'spin 1s linear infinite',
                      }}
                    />
                    <span>Loading routes...</span>
                  </div>
                )}
                <MapView />
              </>
            )}

            {/* Selected school info dialog (when in schools tab) */}
            {activeTab === 'schools' && selectedSchoolForMap && (
              <div style={{
                position: 'absolute',
                bottom: '1rem',
                right: '1rem',
                backgroundColor: 'var(--bg-primary)',
                padding: '1.5rem',
                borderRadius: '8px',
                boxShadow: '0 4px 12px var(--shadow-hover)',
                maxWidth: '400px',
                zIndex: 1000,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '1rem' }}>
                  <div style={{ flex: 1 }}>
                    <h2 style={{ margin: 0, fontSize: '20px', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>{selectedSchoolForMap.name}</h2>
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
                      // Trigger map bounds update by resetting the key
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
                      color: 'var(--text-tertiary)',
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
                {selectedSchoolForMap.schoolPageLink && (
                  <div style={{ marginBottom: '0.75rem' }}>
                    <a
                      href={selectedSchoolForMap.schoolPageLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        fontSize: '14px',
                        color: 'var(--text-primary)',
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
                        color: 'var(--text-primary)',
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
      </div>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

function AdminApp() {
  const { isLoading, selectedSchoolId, setSelectedSchool, schools, setSchools, setRoutes, setLoading } = useStore();
  const [activeTab, setActiveTab] = useState<'schools' | 'routes'>('routes');
  const [selectedSchoolForMap, setSelectedSchoolForMap] = useState<School | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  
  // Load schools
  useEffect(() => {
    const loadSchools = async () => {
      try {
        const response = await fetch('/api/schools');
        if (response.ok) {
          const data = await response.json();
          setSchools(data.schools || []);
          // If no school is selected but schools exist, select the first one
          if (!selectedSchoolId && data.schools && data.schools.length > 0) {
            const westSylvan = data.schools.find((s: School) => s.id === 'west-sylvan');
            setSelectedSchool(westSylvan ? westSylvan.id : data.schools[0].id);
          }
        }
      } catch (error) {
        console.error('Error loading schools:', error);
      }
    };
    loadSchools();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      try {
        const routes = await loadLocalRoutes(selectedSchoolId);
        console.log('[AdminApp] Loaded', routes.length, 'routes');
        setRoutes(routes);
      } catch (error) {
        console.error('[AdminApp] Failed to load routes:', error);
        setRoutes([]); // Set empty array on error
      } finally {
        setLoading(false);
      }
    };

    loadRoutes();
  }, [selectedSchoolId, activeTab, setRoutes, setLoading]);


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
          tabs={<TabBar activeTab={activeTab} onTabChange={setActiveTab} />}
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
            />
          ) : (
            <RouteList 
              showBothOption={true}
              onClearSchool={() => setActiveTab('schools')}
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
                    <DarkModeTileLayer />
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
                        >
                          <Popup>{school.name}</Popup>
                        </Marker>
                      );
                    })}
                  </MapContainer>
                ) : (
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
              })()
            ) : (
              <>
                {isLoading && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '1rem',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      zIndex: 1000,
                      padding: '0.75rem 1.5rem',
                      backgroundColor: 'var(--bg-primary)',
                      color: 'var(--text-primary)',
                      borderRadius: '8px',
                      boxShadow: '0 2px 8px var(--shadow-large)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                    }}
                  >
                    <div
                      style={{
                        width: '16px',
                        height: '16px',
                        border: '2px solid #4ECDC4',
                        borderTopColor: 'transparent',
                        borderRadius: '50%',
                        animation: 'spin 1s linear infinite',
                      }}
                    />
                    <span>Loading routes...</span>
                  </div>
                )}
                <MapView 
                  editingMode={true} 
                  enableStreetHighlighting={true}
                  enableStreetPins={true}
                />
              </>
            )}

            {/* Selected school info dialog (when in schools tab) */}
            {activeTab === 'schools' && selectedSchoolForMap && (
              <div style={{
                position: 'absolute',
                bottom: '1rem',
                right: '1rem',
                backgroundColor: 'var(--bg-primary)',
                padding: '1.5rem',
                borderRadius: '8px',
                boxShadow: '0 4px 12px var(--shadow-hover)',
                maxWidth: '400px',
                zIndex: 1000,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '1rem' }}>
                  <div style={{ flex: 1 }}>
                    <h2 style={{ margin: 0, fontSize: '20px', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>{selectedSchoolForMap.name}</h2>
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
                      // Trigger map bounds update by resetting the key
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
                      color: 'var(--text-tertiary)',
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
                {selectedSchoolForMap.schoolPageLink && (
                  <div style={{ marginBottom: '0.75rem' }}>
                    <a
                      href={selectedSchoolForMap.schoolPageLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        fontSize: '14px',
                        color: 'var(--text-primary)',
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
                        color: 'var(--text-primary)',
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
        <Route path="/" element={<MainApp />} />
        <Route path="/admin" element={<AdminApp />} />
        <Route path="/neighborhoods" element={<NeighborhoodExplorer />} />
        <Route path="/tech" element={<TechPage />} />
        {/* Deprecated: Data Management page - kept for backward compatibility but no longer linked */}
        <Route path="/data" element={<DataManagement />} />
        <Route path="/data/schools" element={<SchoolsList />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
