import { useState, useEffect } from 'react';
import { Header } from '../components/Header';
import { Sidebar } from '../components/Sidebar';
import { SchoolList } from '../components/SchoolList';
import { RouteList } from '../components/RouteList';
import { MapView } from '../components/MapView';
import { TabBar } from '../components/TabBar';
import { useStore } from '../store/useStore';
import { loadLocalRoutes } from '../services/localRoutes';
import { getNeighborhoodsFromRoutes } from '../services/api';
import { Neighborhood } from '../types';

export function NeighborhoodExplorer() {
  const { selectedSchoolId, setSelectedSchool, schools, setSchools, routes, setRoutes, setLoading: setStoreLoading, isLoading, toggleRouteSelection } = useStore();
  const [activeTab, setActiveTab] = useState<'schools' | 'neighborhoods'>('neighborhoods');
  const [neighborhoods, setNeighborhoods] = useState<Neighborhood[]>([]);
  const [loadingNeighborhoods, setLoadingNeighborhoods] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedNeighborhoods, setExpandedNeighborhoods] = useState<Set<string>>(new Set());

  // Load schools
  useEffect(() => {
    const loadSchools = async () => {
      try {
        const response = await fetch('/api/schools');
        if (response.ok) {
          const data = await response.json();
          setSchools(data.schools || []);
        }
      } catch (err) {
        console.error('[NeighborhoodExplorer] Error loading schools:', err);
      }
    };
    loadSchools();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load neighborhoods when school changes or when switching to neighborhoods tab
  useEffect(() => {
    if (activeTab !== 'neighborhoods') {
      return;
    }
    
    async function fetchNeighborhoods() {
      try {
        setLoadingNeighborhoods(true);
        setError(null);
        console.log('[NeighborhoodExplorer] Loading neighborhoods for school:', selectedSchoolId || 'all');
        const data = await getNeighborhoodsFromRoutes(selectedSchoolId || undefined);
        console.log('[NeighborhoodExplorer] Loaded neighborhoods:', data.neighborhoods?.length || 0);
        if (data.neighborhoods && Array.isArray(data.neighborhoods)) {
          setNeighborhoods(data.neighborhoods);
        } else {
          console.warn('[NeighborhoodExplorer] Invalid neighborhoods data:', data);
          setNeighborhoods([]);
        }
      } catch (err: any) {
        console.error('[NeighborhoodExplorer] Error loading neighborhoods:', err);
        const errorMessage = err.message || 'Failed to load neighborhoods';
        setError(errorMessage);
        setNeighborhoods([]);
      } finally {
        setLoadingNeighborhoods(false);
      }
    }
    fetchNeighborhoods();
  }, [selectedSchoolId, activeTab]);

  // Load routes when school is selected and neighborhoods tab is active
  useEffect(() => {
    if (!selectedSchoolId || activeTab !== 'neighborhoods') {
      if (activeTab !== 'neighborhoods') {
        setRoutes([]);
      }
      return;
    }

    console.log('[NeighborhoodExplorer] Loading routes for school:', selectedSchoolId);
    const loadRoutes = async () => {
      setStoreLoading(true);
      try {
        const loadedRoutes = await loadLocalRoutes(selectedSchoolId);
        console.log('[NeighborhoodExplorer] Loaded', loadedRoutes.length, 'routes');
        setRoutes(loadedRoutes);
      } catch (error) {
        console.error('[NeighborhoodExplorer] Failed to load routes:', error);
        setRoutes([]);
      } finally {
        setStoreLoading(false);
      }
    };

    loadRoutes();
  }, [selectedSchoolId, activeTab, setRoutes, setStoreLoading]);

  // Filter neighborhoods by search term
  const filteredNeighborhoods = neighborhoods.filter(n =>
    n.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const toggleNeighborhoodExpand = (neighborhoodName: string) => {
    setExpandedNeighborhoods(prev => {
      const next = new Set(prev);
      if (next.has(neighborhoodName)) {
        next.delete(neighborhoodName);
      } else {
        next.add(neighborhoodName);
      }
      return next;
    });
  };

  // Get routes for a specific neighborhood
  const getRoutesForNeighborhood = (neighborhood: Neighborhood) => {
    if (!selectedSchoolId || routes.length === 0) return [];
    
    // Find routes that serve this neighborhood
    const neighborhoodRouteNames = new Set(neighborhood.routes);
    return routes.filter(route => 
      neighborhoodRouteNames.has(route.name)
    );
  };

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
                  setActiveTab('neighborhoods');
                } else {
                  setSelectedSchool(null);
                }
              }}
            />
          ) : (
            <>
              {/* Search */}
              <div style={{ 
                padding: '1rem', 
                borderBottom: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-primary)',
                flexShrink: 0,
                transition: 'background-color 0.3s ease, border-color 0.3s ease',
              }}>
                <input
                  type="text"
                  placeholder="Search neighborhoods..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    backgroundColor: 'var(--bg-secondary)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '4px',
                    fontSize: '14px',
                    transition: 'background-color 0.3s ease, border-color 0.3s ease',
                  }}
                />
              </div>

              {/* Neighborhoods list */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '0.5rem' }}>
                {error && (
                  <div style={{
                    padding: '1rem',
                    backgroundColor: 'rgba(255, 0, 0, 0.1)',
                    color: '#ff4444',
                    borderRadius: '4px',
                    marginBottom: '1rem',
                    fontSize: '14px',
                    border: '1px solid rgba(255, 0, 0, 0.2)',
                  }}>
                    {error}
                  </div>
                )}

                {loadingNeighborhoods ? (
                  <div style={{
                    padding: '2rem',
                    textAlign: 'center',
                    color: 'var(--text-tertiary)',
                    fontSize: '14px',
                  }}>
                    Loading neighborhoods...
                  </div>
                ) : filteredNeighborhoods.length === 0 ? (
                  <div style={{
                    padding: '2rem',
                    textAlign: 'center',
                    color: 'var(--text-tertiary)',
                    fontSize: '14px',
                  }}>
                    {searchTerm ? 'No neighborhoods found matching your search' : 'No neighborhoods found'}
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {filteredNeighborhoods.map((neighborhood) => {
                      const isExpanded = expandedNeighborhoods.has(neighborhood.name);
                      const neighborhoodRoutes = getRoutesForNeighborhood(neighborhood);
                      
                      return (
                        <div
                          key={neighborhood.name}
                          style={{
                            border: '1px solid var(--border-color)',
                            borderRadius: '4px',
                            backgroundColor: 'var(--bg-primary)',
                            overflow: 'hidden',
                            transition: 'background-color 0.3s ease, border-color 0.3s ease',
                          }}
                        >
                          {/* Neighborhood header */}
                          <div style={{ display: 'flex', alignItems: 'stretch' }}>
                            <div
                              onClick={() => toggleNeighborhoodExpand(neighborhood.name)}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.75rem',
                                padding: '0.75rem',
                                flex: 1,
                                minWidth: 0,
                                cursor: 'pointer',
                                transition: 'background-color 0.15s ease',
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = 'var(--bg-secondary)';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = 'transparent';
                              }}
                            >
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ 
                                  fontWeight: '600', 
                                  fontSize: '16px',
                                  color: 'var(--text-primary)',
                                  marginBottom: '0.25rem',
                                }}>
                                  {neighborhood.name}
                                </div>
                                <div style={{ 
                                  fontSize: '12px', 
                                  color: 'var(--text-tertiary)',
                                  display: 'flex',
                                  gap: '1rem',
                                }}>
                                  <span>{neighborhood.count} {neighborhood.count === 1 ? 'stop' : 'stops'}</span>
                                  <span>{neighborhood.routes.length} {neighborhood.routes.length === 1 ? 'route' : 'routes'}</span>
                                </div>
                              </div>
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleNeighborhoodExpand(neighborhood.name);
                              }}
                              style={{
                                background: 'none',
                                border: 'none',
                                borderLeft: '1px solid var(--border-color)',
                                padding: '0.75rem',
                                cursor: 'pointer',
                                color: 'var(--text-tertiary)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                minWidth: '40px',
                              }}
                              title={isExpanded ? 'Collapse' : 'Expand'}
                            >
                              <i 
                                className="fas fa-chevron-down"
                                style={{ 
                                  transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                                  transition: 'transform 0.2s',
                                  display: 'inline-block',
                                  fontSize: '12px',
                                }}
                              />
                            </button>
                          </div>

                          {/* Expanded routes list */}
                          {isExpanded && neighborhoodRoutes.length > 0 && (
                            <div style={{ 
                              borderTop: '1px solid var(--border-color)',
                              backgroundColor: 'var(--bg-secondary)',
                              maxHeight: '400px',
                              overflowY: 'auto',
                              transition: 'background-color 0.3s ease, border-color 0.3s ease',
                            }}>
                              {neighborhoodRoutes.map((route) => {
                                const isRouteSelected = route.isSelected || false;
                                const routeColor = route.color || '#4ECDC4';
                                
                                return (
                                  <div
                                    key={route.id}
                                    style={{
                                      padding: '0.75rem',
                                      borderBottom: '1px solid var(--border-color)',
                                      backgroundColor: isRouteSelected ? 'var(--bg-tertiary)' : 'transparent',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '0.75rem',
                                      cursor: 'pointer',
                                      transition: 'background-color 0.15s ease',
                                    }}
                                    onClick={() => toggleRouteSelection(route.id)}
                                    onMouseEnter={(e) => {
                                      e.currentTarget.style.backgroundColor = isRouteSelected ? 'var(--bg-tertiary)' : 'var(--bg-primary)';
                                    }}
                                    onMouseLeave={(e) => {
                                      e.currentTarget.style.backgroundColor = isRouteSelected ? 'var(--bg-tertiary)' : 'transparent';
                                    }}
                                  >
                                    <label
                                      style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        cursor: 'pointer',
                                        flexShrink: 0,
                                      }}
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <input
                                        type="checkbox"
                                        checked={isRouteSelected}
                                        onChange={(e) => {
                                          toggleRouteSelection(route.id);
                                        }}
                                        style={{ display: 'none' }}
                                      />
                                      <div
                                        style={{
                                          width: '18px',
                                          height: '18px',
                                          borderRadius: '50%',
                                          border: `2px solid ${routeColor}`,
                                          backgroundColor: isRouteSelected ? routeColor : 'transparent',
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'center',
                                          flexShrink: 0,
                                          boxSizing: 'border-box',
                                        }}
                                      >
                                        {isRouteSelected && (
                                          <i className="fas fa-check" style={{ fontSize: '9px', color: 'white' }}></i>
                                        )}
                                      </div>
                                    </label>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                      <div style={{ fontWeight: '500', color: 'var(--text-primary)' }}>
                                        Route {route.name} {route.direction ? `(${route.direction})` : ''}
                                      </div>
                                      <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '0.25rem' }}>
                                        {route.stops.filter(s => !s.skipGeocoding).length} stops
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                          {isExpanded && neighborhoodRoutes.length === 0 && (
                            <div style={{ 
                              borderTop: '1px solid var(--border-color)',
                              backgroundColor: 'var(--bg-secondary)',
                              padding: '1rem',
                              color: 'var(--text-tertiary)',
                              fontSize: '14px',
                              textAlign: 'center',
                            }}>
                              No routes loaded for this neighborhood
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Summary */}
              {!loadingNeighborhoods && neighborhoods.length > 0 && (
                <div style={{
                  padding: '1rem',
                  borderTop: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-primary)',
                  fontSize: '12px',
                  color: 'var(--text-secondary)',
                  flexShrink: 0,
                  transition: 'background-color 0.3s ease, border-color 0.3s ease',
                }}>
                  {filteredNeighborhoods.length} of {neighborhoods.length} neighborhoods
                </div>
              )}

              {/* Routes section */}
              {selectedSchoolId && routes.length > 0 && (
                <div style={{
                  borderTop: '2px solid var(--border-color)',
                  flexShrink: 0,
                  maxHeight: '50%',
                  display: 'flex',
                  flexDirection: 'column',
                  transition: 'border-color 0.3s ease',
                  overflow: 'hidden',
                }}>
                  <RouteList 
                    showBothOption={false}
                    onClearSchool={() => setSelectedSchool(null)}
                  />
                </div>
              )}
            </>
          )}
        </Sidebar>

        {/* Map */}
        <div style={{ flex: 1, position: 'relative', display: 'flex', flexDirection: 'column' }}>
          <div style={{ flex: 1, position: 'relative' }}>
            {activeTab === 'neighborhoods' ? (
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
            ) : null}
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
