import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Header } from '../components/Header';
import { SEO } from '../components/SEO';
import { useIsMobile } from '../hooks/useMediaQuery';

interface NeighborhoodData {
  name: string;
  schoolIds: string[];
  routeCount: number;
  stopCount: number;
  schools: Array<{ id: string; name: string }>;
}

export function NeighborhoodDirectory() {
  const [neighborhoods, setNeighborhoods] = useState<NeighborhoodData[]>([]);
  const [loading, setLoading] = useState(true);
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
    async function fetchNeighborhoods() {
      try {
        setLoading(true);
        const response = await fetch('/api/neighborhoods/data');
        if (response.ok) {
          const data = await response.json();
          setNeighborhoods(data);
        }
      } catch (err) {
        console.error('Failed to load neighborhoods:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchNeighborhoods();
  }, []);

  const filteredNeighborhoods = useMemo(() => {
    return neighborhoods.filter(n =>
      n.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      n.schools.some(s => s.name.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }, [neighborhoods, searchTerm]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', backgroundColor: 'var(--bg-primary)' }}>
      <SEO 
        title="Neighborhood Bus Maps" 
        description="Find bus routes and stops by neighborhood in Portland. Browse active bus stops in your local area."
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
          <h1 style={{ color: 'var(--text-primary)', marginBottom: '1rem' }}>Portland Neighborhood Bus Stop Maps</h1>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
            Find active bus routes and school stops serving your Portland neighborhood.
          </p>
          
          <div style={{ position: 'relative', maxWidth: '500px' }}>
            <input
              type="text"
              placeholder="Search by neighborhood or school..."
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
            <p>Loading neighborhoods...</p>
          </div>
        ) : (
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(350px, 1fr))', 
            gap: '1.5rem' 
          }}>
            {filteredNeighborhoods.map(neighborhood => (
              <div 
                key={neighborhood.name}
                style={{ 
                  display: 'flex',
                  flexDirection: 'column',
                  padding: '1.5rem',
                  backgroundColor: 'var(--bg-secondary)',
                  borderRadius: '16px',
                  boxShadow: '0 2px 8px var(--shadow-large)',
                }}
              >
                <h2 style={{ 
                  margin: '0 0 1rem 0', 
                  fontSize: '1.25rem', 
                  color: 'var(--text-primary)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  {neighborhood.name} Bus Stops
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', fontWeight: 'normal' }}>
                    {neighborhood.stopCount} stops
                  </span>
                </h2>
                
                <div style={{ marginBottom: '1rem' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Serving Schools:
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                    {neighborhood.schools.map(school => (
                      <Link 
                        key={school.id}
                        to={`/bus-route-explorer/${school.id}`}
                        style={{ 
                          fontSize: '0.875rem', 
                          color: '#4ECDC4', 
                          textDecoration: 'none',
                          padding: '0.25rem 0.75rem',
                          backgroundColor: 'rgba(78, 205, 196, 0.1)',
                          borderRadius: '999px',
                          border: '1px solid rgba(78, 205, 196, 0.2)',
                          transition: 'all 0.2s ease'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = 'rgba(78, 205, 196, 0.2)';
                          e.currentTarget.style.borderColor = 'rgba(78, 205, 196, 0.4)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'rgba(78, 205, 196, 0.1)';
                          e.currentTarget.style.borderColor = 'rgba(78, 205, 196, 0.2)';
                        }}
                      >
                        {school.name}
                      </Link>
                    ))}
                  </div>
                </div>
                
                <div style={{ marginTop: 'auto', paddingTop: '1rem', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                    {neighborhood.routeCount} Active Routes
                  </span>
                  <Link 
                    to="/bus-route-explorer"
                    style={{ 
                      fontSize: '0.875rem', 
                      color: 'var(--text-tertiary)',
                      textDecoration: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.25rem'
                    }}
                  >
                    Explore Map <i className="fas fa-chevron-right" style={{ fontSize: '0.75rem' }}></i>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

