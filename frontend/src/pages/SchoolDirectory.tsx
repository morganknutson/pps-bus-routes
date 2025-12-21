import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Header } from '../components/Header';
import { SEO } from '../components/SEO';
import { School } from '../types';
import { getSchoolTypes, getSchoolColor } from '../utils/schoolUtils';
import { useIsMobile } from '../hooks/useMediaQuery';

export function SchoolDirectory() {
  const [schools, setSchools] = useState<School[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const isMobile = useIsMobile();

  useEffect(() => {
    async function fetchSchools() {
      try {
        setLoading(true);
        const response = await fetch('/api/schools');
        if (response.ok) {
          const data = await response.json();
          setSchools(data.schools || []);
        }
      } catch (err) {
        console.error('Failed to load schools:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchSchools();
  }, []);

  const filteredSchools = useMemo(() => {
    return schools.filter(school =>
      school.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (school.address && school.address.toLowerCase().includes(searchTerm.toLowerCase()))
    ).sort((a, b) => a.name.localeCompare(b.name));
  }, [schools, searchTerm]);

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
          <h1 style={{ color: 'var(--text-primary)', marginBottom: '1rem' }}>PPS School Directory</h1>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
            Select a school to view its interactive bus route maps and stop schedules.
          </p>
          
          <div style={{ position: 'relative', maxWidth: '500px' }}>
            <input
              type="text"
              placeholder="Search schools by name or address..."
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
              
              return (
                <Link 
                  key={school.id}
                  to={`/bus-route-explorer/${school.id}`}
                  style={{ 
                    textDecoration: 'none',
                    display: 'flex',
                    flexDirection: 'column',
                    padding: '1.5rem',
                    backgroundColor: 'var(--bg-secondary)',
                    borderRadius: '16px',
                    borderLeft: `6px solid ${schoolColor}`,
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
                  }}>{school.name}</h2>
                  
                  <div style={{ 
                    fontSize: '0.875rem', 
                    color: schoolColor, 
                    fontWeight: '600',
                    marginBottom: '0.75rem'
                  }}>
                    {schoolTypes.join(' & ')}
                  </div>
                  
                  {school.address && (
                    <div style={{ 
                      fontSize: '0.875rem', 
                      color: 'var(--text-secondary)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem'
                    }}>
                      <i className="fas fa-map-marker-alt" style={{ width: '14px' }}></i>
                      <span>{school.address.split(',')[0]}</span>
                    </div>
                  )}
                  
                  <div style={{ marginTop: 'auto', paddingTop: '1rem', display: 'flex', justifyContent: 'flex-end' }}>
                    <span style={{ 
                      fontSize: '0.875rem', 
                      color: 'var(--text-tertiary)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.25rem'
                    }}>
                      View Routes <i className="fas fa-chevron-right" style={{ fontSize: '0.75rem' }}></i>
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

