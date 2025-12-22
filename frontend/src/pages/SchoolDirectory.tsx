import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Header } from '../components/Header';
import { SEO } from '../components/SEO';
import { School } from '../types';
import { getSchoolTypes, getSchoolColor } from '../utils/schoolUtils';
import { useIsMobile } from '../hooks/useMediaQuery';
import { useDarkMode } from '../hooks/useDarkMode';
import { MapPinIcon } from '../components/MapPinIcon';
import { Footer } from '../components/Footer';

export function SchoolDirectory() {
  const [schools, setSchools] = useState<School[]>([]);
  const [neighborhoods, setNeighborhoods] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { isDarkMode } = useDarkMode();
  const [searchTerm, setSearchTerm] = useState('');

  const isMobile = useIsMobile();

  useEffect(() => {
    const rootElement = document.getElementById('root');
    if (rootElement) {
      rootElement.style.overflow = 'auto';
      rootElement.style.height = 'auto';
      rootElement.style.minHeight = '100vh';
    }
    document.body.style.overflow = 'auto';
    document.documentElement.style.overflow = 'auto';
    
    return () => {
      if (rootElement) {
        rootElement.style.overflow = 'hidden';
        rootElement.style.height = 'var(--app-height)';
      }
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
    };
  }, []);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        const [schoolsRes, neighborhoodsRes] = await Promise.all([
          fetch('/api/schools?includeStats=true'),
          fetch('/api/neighborhoods/data')
        ]);
        
        if (schoolsRes.ok) {
          const data = await schoolsRes.json();
          setSchools(data.schools || []);
        }
        
        if (neighborhoodsRes.ok) {
          const data = await neighborhoodsRes.json();
          setNeighborhoods(data);
        }
      } catch (err) {
        console.error('Failed to load data:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  // Map school IDs to neighborhood names
  const schoolToNeighborhood = useMemo(() => {
    const map = new Map<string, string>();
    neighborhoods.forEach(n => {
      n.schoolIds.forEach((id: string) => {
        // If multiple neighborhoods serve a school, we'll just take the last one for now
        // or we could combine them.
        map.set(id, n.name);
      });
    });
    return map;
  }, [neighborhoods]);

  const filteredSchools = useMemo(() => {
    return schools.filter(school => {
      const neighborhood = schoolToNeighborhood.get(school.id) || '';
      return (
        school.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (school.address && school.address.toLowerCase().includes(searchTerm.toLowerCase())) ||
        neighborhood.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }).sort((a, b) => a.name.localeCompare(b.name));
  }, [schools, searchTerm, schoolToNeighborhood]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', backgroundColor: 'var(--bg-primary)' }}>
      <SEO 
        title="School Directory" 
        description="Browse all Portland Public Schools to find bus routes, stop locations, and schedules for your school."
      />
      <Header />
      
      <main style={{ 
        flex: 1, 
        width: '100%', 
        maxWidth: '1200px', 
        margin: '0 auto', 
        padding: isMobile ? '1rem' : '2rem',
        boxSizing: 'border-box'
      }}>
        <div style={{ marginBottom: '2rem' }}>
          <h1 style={{ color: 'var(--text-primary)', marginBottom: '1rem' }}>PPS Bus Routes & Stops Directory</h1>
          <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
            <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
              Select a school to view its interactive bus route maps and stop schedules.
            </p>
            <Link 
              to="/neighborhood-directory" 
              style={{ 
                color: 'var(--text-primary)', 
                textDecoration: 'none', 
                fontSize: '0.875rem',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.25rem 0.75rem',
                backgroundColor: 'var(--bg-tertiary)',
                borderRadius: '999px',
                border: '1px solid var(--border-color)',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--bg-secondary)';
                e.currentTarget.style.borderColor = 'var(--text-tertiary)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)';
                e.currentTarget.style.borderColor = 'var(--border-color)';
              }}
            >
              <i className="fas fa-city"></i> Browse by Neighborhood
            </Link>
          </div>
          
          <div style={{ position: 'relative', width: '100%' }}>
            <input
              type="text"
              placeholder="Search by school, address, or neighborhood..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: '100%',
                padding: '0.875rem 1rem',
                paddingLeft: '2.5rem',
                borderRadius: '12px',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-secondary)',
                color: 'var(--text-primary)',
                fontSize: '16px',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
            <i className="fas fa-search" style={{ 
              position: 'absolute', 
              left: '1rem', 
              top: '50%', 
              transform: 'translateY(-50%)',
              color: 'var(--text-tertiary)'
            }}></i>
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
            <i className="fas fa-spinner fa-spin" style={{ fontSize: '2rem', marginBottom: '1rem' }}></i>
            <p>Loading schools...</p>
          </div>
        ) : (
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(300px, 1fr))', 
            gap: '1.5rem' 
          }}>
            {filteredSchools.map(school => {
              const schoolTypes = school.schoolTypes || getSchoolTypes(school.name);
              const schoolColor = getSchoolColor(schoolTypes);
              const neighborhood = schoolToNeighborhood.get(school.id);
              
              return (
                <Link 
                  key={school.id}
                  to={`/${school.id}`}
                  style={{ 
                    textDecoration: 'none',
                    display: 'flex',
                    flexDirection: 'column',
                    padding: '1.5rem',
                    backgroundColor: 'var(--bg-secondary)',
                    borderRadius: '16px',
                    borderLeft: `2px solid ${schoolColor}`,
                    boxShadow: '0 2px 8px var(--shadow-large)',
                    transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-4px)';
                    e.currentTarget.style.boxShadow = '0 4px 12px var(--shadow-hover)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 2px 8px var(--shadow-large)';
                  }}
                >
                  <h2 style={{ 
                    margin: '0 0 0.5rem 0', 
                    fontSize: '1.25rem', 
                    color: 'var(--text-primary)' 
                  }}>{school.name} Bus Routes & Stops</h2>
                  
                  <div style={{ 
                    fontSize: '0.875rem', 
                    color: schoolColor, 
                    fontWeight: '600',
                    marginBottom: '0.75rem',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <i className="fas fa-graduation-cap" style={{ width: '16px' }}></i>
                      {schoolTypes.join(' & ')}
                    </span>
                    {neighborhood && (
                      <span style={{ 
                        fontSize: '0.75rem', 
                        color: 'var(--text-tertiary)',
                        fontWeight: 'normal',
                        padding: '0.125rem 0.5rem',
                        backgroundColor: 'var(--bg-tertiary)',
                        borderRadius: '4px'
                      }}>
                        {neighborhood}
                      </span>
                    )}
                  </div>
                  
                  {school.address && (
                    <div style={{ 
                      fontSize: '0.875rem', 
                      color: 'var(--text-secondary)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem'
                    }}>
                      <MapPinIcon width={14} height={18} style={{ flexShrink: 0 }} />
                      <span>{school.address.split(',')[0]}</span>
                    </div>
                  )}
                  
                  <div style={{ marginTop: 'auto', paddingTop: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ 
                      fontSize: '0.8125rem', 
                      color: school.routeCount === 0 ? '#f44' : 'var(--text-tertiary)',
                      fontWeight: school.routeCount === 0 ? '600' : 'normal',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.375rem'
                    }}>
                      {school.routeCount === 0 ? (
                        <>
                          <i className="fas fa-exclamation-circle"></i> Routes not provided by district
                        </>
                      ) : (
                        <>
                          <i className="fas fa-bus"></i> {school.routeCount} {school.routeCount === 1 ? 'Route' : 'Routes'}
                        </>
                      )}
                    </span>
                    <span style={{ 
                      fontSize: '0.875rem', 
                      color: 'var(--text-tertiary)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.25rem'
                    }}>
                      {school.routeCount === 0 ? 'Details' : 'View Routes'} <i className="fas fa-chevron-right" style={{ fontSize: '0.75rem' }}></i>
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}

