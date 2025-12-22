import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import { School } from '../types';
import { DataPageHeader } from '../components/DataPageHeader';
import { SchoolTypeFilter, SchoolTypeFilters } from '../components/SchoolTypeFilter';
import { getSchoolTypes, getSchoolColor, createSchoolIcon, getSchoolDisplayName } from '../utils/schoolUtils';
import { handleMapLinkClick } from '../utils/mapLinks';
import { createDefaultMarkerIcon } from '../utils/fontAwesomeIcons';
import { useMarkers, MarkerData } from '../hooks/useMarkers';
import { ProgressBar } from '../components/ProgressBar';
import { RouteIcon } from '../components/RouteIcon';
import 'leaflet/dist/leaflet.css';

// Set default marker icon to use Font Awesome
const defaultIcon = createDefaultMarkerIcon();
L.Marker.prototype.options.icon = defaultIcon;


// Component to handle map zoom - zooms to selected school or fits all schools
function FitBounds({ schools, selectedSchool }: { schools: School[]; selectedSchool: School | null }) {
  const map = useMap();
  const prevSelectedSchoolIdRef = useRef<string | null>(null);
  
  useEffect(() => {
    if (!map) {
      return;
    }

    const currentSchoolId = selectedSchool?.id || null;
    const wasSelectedBefore = prevSelectedSchoolIdRef.current !== null;
    const isNewSelection = currentSchoolId !== prevSelectedSchoolIdRef.current;

    if (selectedSchool && selectedSchool.coordinates && selectedSchool.coordinates.length === 2) {
      if (!isNewSelection) return;

      // Zoom to selected school
      const [lng, lat] = selectedSchool.coordinates;
      
      // Update ref immediately
      prevSelectedSchoolIdRef.current = currentSchoolId;

      const timer = setTimeout(() => {
        try {
          map.setView([lat, lng], 16, { animate: true });
        } catch (error) {
          console.error('[FitBounds] Error setting view:', error);
        }
      }, 100);
      return () => clearTimeout(timer);
    } else if (!selectedSchool && wasSelectedBefore) {
      // No school selected - zoom out to show all schools
      const schoolsWithCoords = schools.filter(s => s.coordinates && s.coordinates.length === 2);
      if (schoolsWithCoords.length > 0) {
        // Update ref immediately
        prevSelectedSchoolIdRef.current = null;

        const timer = setTimeout(() => {
          try {
            const bounds = L.latLngBounds(
              schoolsWithCoords.map(s => [s.coordinates![1], s.coordinates![0]] as [number, number])
            );
            map.fitBounds(bounds, { padding: [50, 50], animate: true });
          } catch (error) {
            console.error('[FitBounds] Error fitting bounds:', error);
          }
        }, 100);
        return () => clearTimeout(timer);
      }
    }
  }, [map, schools, selectedSchool]);
  
  return null;
}

// Component that uses the useMarkers hook to manage school markers
function SchoolMarkersManager({ 
  schools, 
  onSchoolClick 
}: { 
  schools: School[]; 
  onSchoolClick: (school: School) => void;
}) {
  // Memoize the click handler to avoid recreating markers unnecessarily
  const handleSchoolClick = useCallback((school: School) => {
    onSchoolClick(school);
  }, [onSchoolClick]);

  // Convert schools to marker data format
  // Use stable keys based on school IDs and positions
  const markerData: MarkerData[] = useMemo(() => {
    const data = schools
      .filter(s => s.coordinates && s.coordinates.length === 2)
      .map(school => {
        const schoolTypes = school.schoolTypes || getSchoolTypes(school.name);
        const schoolColor = getSchoolColor(schoolTypes);
        return {
          id: school.id,
          position: [school.coordinates![1], school.coordinates![0]] as [number, number], // [lat, lng]
          icon: createSchoolIcon(schoolColor),
          onClick: () => handleSchoolClick(school),
        };
      });
    return data;
  }, [schools, handleSchoolClick]);

  // Use the reusable hook to manage markers
  // This hook manually adds/removes markers from the Leaflet map instance
  // ensuring reliable marker management when the array changes
  useMarkers(markerData, { debug: true }); // ENABLE DEBUG

  return null; // This component doesn't render anything
}

interface SchedulerStatus {
  enabled: boolean;
  lastRun: string | null;
  lastRunStatus: 'success' | 'error' | 'running' | null;
  lastRunError: string | null;
  nextRun: string | null;
}

export function SchoolsList() {
  const [schools, setSchools] = useState<School[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSchool, setSelectedSchool] = useState<School | null>(null);
  const [schoolTypeFilters, setSchoolTypeFilters] = useState<SchoolTypeFilters>({
    elementary: true,
    middle: true,
    high: true,
    hybrid: true,
  });
  const [updatingAddress, setUpdatingAddress] = useState(false);
  
  // Scheduler state
  const [schedulerStatus, setSchedulerStatus] = useState<SchedulerStatus | null>(null);
  const [schedulerLoading, setSchedulerLoading] = useState(false);

  useEffect(() => {
    async function fetchSchools() {
      try {
        setLoading(true);
        const response = await fetch('/api/schools');
        if (!response.ok) {
          throw new Error('Failed to fetch schools');
        }
        const data = await response.json();
        setSchools(data.schools || []);
      } catch (err: any) {
        setError(err.message || 'Failed to load schools');
      } finally {
        setLoading(false);
      }
    }
    fetchSchools();
  }, []);

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

  // Memoize filtered schools to avoid unnecessary recalculations
  const filteredSchools = useMemo(() => {
    const filtered = schools.filter(school => {
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
    return filtered;
  }, [schools, searchTerm, schoolTypeFilters.elementary, schoolTypeFilters.middle, schoolTypeFilters.high, schoolTypeFilters.hybrid]);

  const allSchoolsWithCoords = schools.filter(s => s.coordinates && s.coordinates.length === 2);
  const schoolsWithCoords = useMemo(() => {
    return filteredSchools.filter(s => s.coordinates && s.coordinates.length === 2);
  }, [filteredSchools]);
  const schoolsWithoutCoords = filteredSchools.filter(s => !s.coordinates || s.coordinates.length !== 2);

  // Handle school selection toggle - clicking a selected school deselects it
  const handleSchoolClick = useCallback((school: School) => {
    setSelectedSchool(prev => prev?.id === school.id ? null : school);
  }, []);

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        flexDirection: 'column',
        gap: '1rem'
      }}>
        <div style={{ width: '300px' }}>
          <ProgressBar label="Loading schools..." height={8} />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ 
        padding: '2rem',
        textAlign: 'center'
      }}>
        <h1>Error</h1>
        <p style={{ color: '#d32f2f' }}>{error}</p>
        <Link 
          to="/" 
          style={{ color: '#000', textDecoration: 'none' }}
          onMouseEnter={(e) => {
            e.currentTarget.style.textDecoration = 'underline';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.textDecoration = 'none';
          }}
        >
          ← Back to Home
        </Link>
      </div>
    );
  }

  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      height: '100vh',
      backgroundColor: '#fafafa'
    }}>
      {/* Header */}
      <DataPageHeader 
        title="Data Management"
        showAutoUpdate={true}
        schedulerStatus={schedulerStatus}
        onToggleScheduler={handleToggleScheduler}
        schedulerLoading={schedulerLoading}
      />
      
      {/* Stats Bar */}
      <div style={{
        backgroundColor: 'white',
        borderBottom: '1px solid #ddd',
        padding: '0.75rem 2rem',
        fontSize: '14px',
        color: '#666',
      }}>
        {schools.length} schools {allSchoolsWithCoords.length > 0 && `• ${allSchoolsWithCoords.length} with locations`}
      </div>

      {/* Search and Content */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Sidebar with school list */}
        <div style={{
          width: '400px',
          backgroundColor: 'white',
          borderRight: '1px solid #ddd',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}>
          {/* School Type Filters */}
          <SchoolTypeFilter 
            filters={schoolTypeFilters}
            onChange={setSchoolTypeFilters}
          />

          {/* Search */}
          <div style={{ padding: '1rem', borderBottom: '1px solid #ddd' }}>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                placeholder="Search schools..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  paddingRight: searchTerm ? '2.5rem' : '0.75rem',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  fontSize: '14px',
                  boxSizing: 'border-box',
                  transition: 'padding-right 0.2s ease',
                }}
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  style={{
                    position: 'absolute',
                    right: '8px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    width: '20px',
                    height: '20px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '16px',
                    lineHeight: '1',
                    backgroundColor: 'transparent',
                    color: '#999',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    padding: 0,
                    flexShrink: 0,
                    transition: 'background-color 0.2s ease, color 0.2s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#f0f0f0';
                    e.currentTarget.style.color = '#333';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.color = '#999';
                  }}
                  aria-label="Clear search"
                >
                  ×
                </button>
              )}
            </div>
          </div>

          {/* School list */}
          <div style={{ flex: 1, overflow: 'auto' }}>
            {filteredSchools.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: '#666' }}>
                No schools found
              </div>
            ) : (
              <div>
                {schoolsWithCoords.map((school) => {
                  const schoolTypes = school.schoolTypes || getSchoolTypes(school.name);
                  const schoolColor = getSchoolColor(schoolTypes);
                  return (
                    <div
                      key={school.id}
                      onClick={() => handleSchoolClick(school)}
                      style={{
                        padding: '1rem',
                        borderBottom: '1px solid #eee',
                        borderLeft: `4px solid ${schoolColor}`,
                        cursor: 'pointer',
                        backgroundColor: selectedSchool?.id === school.id ? '#f0f9ff' : 'white',
                        transition: 'background-color 0.2s',
                      }}
                      onMouseEnter={(e) => {
                        if (selectedSchool?.id !== school.id) {
                          e.currentTarget.style.backgroundColor = '#f9f9f9';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (selectedSchool?.id !== school.id) {
                          e.currentTarget.style.backgroundColor = 'white';
                        }
                      }}
                    >
                      <div style={{ fontWeight: '600', fontSize: '18px', color: '#333', marginBottom: '0.25rem' }}>
                        {getSchoolDisplayName(school.name)}
                      </div>
                      <div style={{ fontSize: '12px', color: schoolColor, marginBottom: '0.25rem', fontWeight: '500' }}>
                        {schoolTypes.join(' & ')}
                      </div>
                      {school.address && (
                        <div style={{ fontSize: '12px', color: '#666', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                          <i className="fas fa-map-marker-alt" style={{ fontSize: '12px', color: '#999', width: '12px', display: 'flex', justifyContent: 'center' }}></i>
                          <span>{school.address.split(',')[0]}</span>
                        </div>
                      )}
                      {school.routeCount !== undefined && (
                        <div style={{ fontSize: '11px', color: '#999' }}>
                          {school.routeCount} {school.routeCount === 1 ? 'route' : 'routes'}
                        </div>
                      )}
                    </div>
                  );
                })}
                {schoolsWithoutCoords.length > 0 && (
                  <div style={{ padding: '1rem', backgroundColor: '#fff9e6', borderTop: '2px solid #ffd700' }}>
                    <div style={{ fontSize: '12px', fontWeight: '600', color: '#666', marginBottom: '0.5rem' }}>
                      Schools without coordinates ({schoolsWithoutCoords.length})
                    </div>
                    {schoolsWithoutCoords.map((school) => (
                      <div
                        key={school.id}
                        style={{
                          padding: '0.5rem',
                          fontSize: '14px',
                          color: '#666',
                        }}
                      >
                        {school.name}
                        {school.address && (
                          <div style={{ fontSize: '11px', color: '#999', marginTop: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                            <i className="fas fa-map-marker-alt" style={{ fontSize: '11px', width: '11px', display: 'flex', justifyContent: 'center' }}></i>
                            <span>{school.address}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Map */}
        <div style={{ flex: 1, position: 'relative' }}>
          {schoolsWithCoords.length > 0 ? (
            <MapContainer
              center={[45.5152, -122.6784]} // Portland center
              zoom={12}
              style={{ height: '100%', width: '100%' }}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
              />
              <FitBounds schools={schoolsWithCoords} selectedSchool={selectedSchool} />
              <SchoolMarkersManager schools={schoolsWithCoords} onSchoolClick={handleSchoolClick} />
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
          )}
        </div>
      </div>

      {/* Selected school details panel */}
      {selectedSchool && (
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
              <h2 style={{ margin: 0, fontSize: '20px', color: '#333', marginBottom: '0.5rem' }}>{getSchoolDisplayName(selectedSchool.name)}</h2>
              {(() => {
                const schoolTypes = selectedSchool.schoolTypes || getSchoolTypes(selectedSchool.name);
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
              onClick={() => setSelectedSchool(null)}
              type="button"
              style={{
                background: 'none',
                border: 'none',
                fontSize: '20px',
                cursor: 'pointer',
                color: '#999',
                padding: '4px',
                lineHeight: '1',
                flexShrink: 0,
                minWidth: '24px',
                minHeight: '24px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 1001,
                position: 'relative',
              }}
              aria-label="Close dialog"
            >
              ×
            </button>
          </div>
          {selectedSchool.routeCount !== undefined && (
            <div style={{ marginBottom: '0.75rem' }}>
              <div style={{ fontSize: '12px', color: '#666', marginBottom: '0.25rem' }}>Routes</div>
              <div style={{ fontSize: '14px', color: '#333', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <RouteIcon size={14} color="#999" />
                <span>{selectedSchool.routeCount} {selectedSchool.routeCount === 1 ? 'route' : 'routes'} available</span>
              </div>
            </div>
          )}
          {selectedSchool.neighborhood && (
            <div style={{ marginBottom: '0.75rem' }}>
              <div style={{ fontSize: '12px', color: '#666', marginBottom: '0.25rem' }}>Neighborhood</div>
              <div style={{ fontSize: '14px', color: '#333', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <i className="fas fa-map-marker-alt" style={{ fontSize: '14px', color: '#999' }}></i>
                <span>{selectedSchool.neighborhood}</span>
              </div>
            </div>
          )}
          {selectedSchool.address && (
            <div style={{ marginBottom: '0.75rem' }}>
              <div style={{ fontSize: '12px', color: '#666', marginBottom: '0.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Address</span>
                <button
                  onClick={async () => {
                    if (!selectedSchool) return;
                    setUpdatingAddress(true);
                    try {
                      const response = await fetch(`/api/schools/${selectedSchool.id}/update-address`, {
                        method: 'POST',
                      });
                      if (!response.ok) {
                        const error = await response.json();
                        alert(`Failed to update address: ${error.error || 'Unknown error'}`);
                        return;
                      }
                      const data = await response.json();
                      // Update the school in the list
                      setSchools(prev => prev.map(s => 
                        s.id === selectedSchool.id ? data.school : s
                      ));
                      // Update selected school
                      setSelectedSchool(data.school);
                      // Refresh schools list
                      const schoolsResponse = await fetch('/api/schools');
                      if (schoolsResponse.ok) {
                        const schoolsData = await schoolsResponse.json();
                        setSchools(schoolsData.schools || []);
                      }
                    } catch (err: any) {
                      alert(`Error updating address: ${err.message}`);
                    } finally {
                      setUpdatingAddress(false);
                    }
                  }}
                  disabled={updatingAddress}
                  style={{
                    background: updatingAddress ? '#ccc' : '#4ECDC4',
                    color: 'white',
                    border: 'none',
                    padding: '0.25rem 0.5rem',
                    borderRadius: '4px',
                    fontSize: '11px',
                    cursor: updatingAddress ? 'not-allowed' : 'pointer',
                    fontWeight: '500',
                  }}
                >
                  {updatingAddress ? 'Updating...' : 'Update'}
                </button>
              </div>
              <a
                href="#"
                onClick={(e) => handleMapLinkClick(e, selectedSchool.address!, selectedSchool.coordinates)}
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
                <i className="fas fa-map-marker-alt" style={{ fontSize: '14px', color: '#999', width: '14px', display: 'flex', justifyContent: 'center' }}></i>
                <span>{selectedSchool.address}</span>
              </a>
            </div>
          )}
          {!selectedSchool.address && (
            <div style={{ marginBottom: '0.75rem' }}>
              <button
                onClick={async () => {
                  if (!selectedSchool) return;
                  setUpdatingAddress(true);
                  try {
                    const response = await fetch(`/api/schools/${selectedSchool.id}/update-address`, {
                      method: 'POST',
                    });
                    if (!response.ok) {
                      const error = await response.json();
                      alert(`Failed to update address: ${error.error || 'Unknown error'}`);
                      return;
                    }
                    const data = await response.json();
                    // Update the school in the list
                    setSchools(prev => prev.map(s => 
                      s.id === selectedSchool.id ? data.school : s
                    ));
                    // Update selected school
                    setSelectedSchool(data.school);
                    // Refresh schools list
                    const schoolsResponse = await fetch('/api/schools');
                    if (schoolsResponse.ok) {
                      const schoolsData = await schoolsResponse.json();
                      setSchools(schoolsData.schools || []);
                    }
                  } catch (err: any) {
                    alert(`Error updating address: ${err.message}`);
                  } finally {
                    setUpdatingAddress(false);
                  }
                }}
                disabled={updatingAddress}
                style={{
                  background: updatingAddress ? '#ccc' : '#4ECDC4',
                  color: 'white',
                  border: 'none',
                  padding: '0.5rem 1rem',
                  borderRadius: '4px',
                  fontSize: '14px',
                  cursor: updatingAddress ? 'not-allowed' : 'pointer',
                  fontWeight: '500',
                  width: '100%',
                }}
              >
                {updatingAddress ? 'Fetching Address...' : 'Fetch Address from Google Places'}
              </button>
            </div>
          )}
          {selectedSchool.schoolPageLink && (
            <div style={{ marginBottom: '0.75rem' }}>
              <a
                href={selectedSchool.schoolPageLink}
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
          {selectedSchool.driveLink && (
            <div>
              <a
                href={selectedSchool.driveLink}
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
  );
}
