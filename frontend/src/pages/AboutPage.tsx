import { useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Header } from '../components/Header';
import { SEO } from '../components/SEO';
import { useDarkMode } from '../hooks/useDarkMode';
import { Footer } from '../components/Footer';
import { useIsMobile } from '../hooks/useMediaQuery';

export function AboutPage() {
  const { isDarkMode } = useDarkMode();
  const isMobile = useIsMobile();

  const peterTenure = useMemo(() => {
    const startDate = new Date('2025-08-01');
    const now = new Date();
    
    let months = (now.getFullYear() - startDate.getFullYear()) * 12;
    months += now.getMonth() - startDate.getMonth();
    
    // Adjust if current day is before start day of month (optional refinement)
    if (now.getDate() < startDate.getDate()) {
      months--;
    }
    
    return months < 0 ? 0 : months;
  }, []);

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

  return (
    <div style={{
      backgroundColor: 'var(--bg-primary)',
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
    }}>
      <SEO 
        title="About" 
        description="Learn about the PPS Bus Routes project - an interactive mapping platform designed to help Portland Public Schools families navigate the district's transportation system." 
      />
      <Header />
      
      <main style={{
        flex: 1,
        width: '100%',
        maxWidth: '800px',
        margin: '0 auto',
        padding: '4rem 2rem',
        boxSizing: 'border-box',
      }}>
        <h1 style={{ fontSize: '32px', marginBottom: '2rem', color: 'var(--text-primary)' }}>About PPS Bus Routes</h1>
        
        <section style={{ marginBottom: '3rem' }}>
          <h2 style={{ fontSize: '24px', marginBottom: '1.5rem', color: 'var(--text-primary)' }}>What</h2>
          <p style={{ lineHeight: '1.6', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
            PPS Bus Routes is an interactive mapping platform designed to help Portland Public Schools families navigate the district's transportation system. We take the official, often difficult-to-read route PDFs and transform them into a modern, searchable map interface.
          </p>
        </section>

        <section style={{ marginBottom: '3rem' }}>
          <h2 style={{ fontSize: '24px', marginBottom: '1.5rem', color: 'var(--text-primary)' }}>Why</h2>
          <p style={{ lineHeight: '1.6', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
            Static PDF documents are cumbersome, especially on mobile devices. By providing a geographic view of every route and stop, we empower parents and students to quickly find their closest assigned stop, understand the full route path, and better plan their daily commutes.
          </p>
        </section>

        <section style={{ marginBottom: '3rem' }}>
          <h2 style={{ fontSize: '24px', marginBottom: '1.5rem', color: 'var(--text-primary)' }}>How</h2>
          <p style={{ lineHeight: '1.6', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
            Our system regularly monitors the PPS website for updated transportation documents. When a new route is published, our automated pipeline extracts the stop locations, geocodes the addresses into coordinates, and plots them accurately on our interactive map.
          </p>
        </section>

        <section style={{ marginBottom: '3rem' }}>
          <h2 style={{ fontSize: '24px', marginBottom: '1.5rem', color: 'var(--text-primary)' }}>Who</h2>
          <p style={{ lineHeight: '1.6', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
            This platform was built by a father of two students in the Portland Public Schools District. He spent almost two weeks designing and building this system because the current method of delivering bus routes to parents and students is the opposite of user-friendly; in fact, it's practically hostile.
          </p>
          <p style={{ lineHeight: '1.6', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
            Nobody should need to spend 30 minutes solving a puzzle of poorly displayed and poorly entered data just to find their closest bus stop. He also thinks it's a travesty that the technology in the PPS district is in such disrepair, and hopes for change.
          </p>
          <p style={{ lineHeight: '1.6', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
            If you're also unhappy with the experience provided by the technology team at PPS, you're always welcome to send them a note.
          </p>
          
          <div style={{ 
            display: 'flex', 
            flexDirection: isMobile ? 'column' : 'row', 
            gap: isMobile ? '1rem' : '1.5rem', 
            marginTop: '2rem',
            flexWrap: 'wrap'
          }}>
            <div style={{ 
              flex: 1, 
              minWidth: '200px',
              padding: '1.5rem',
              border: '1px solid var(--border-color)',
              borderRadius: '12px',
              backgroundColor: 'var(--bg-secondary)',
            }}>
              <div style={{ height: isMobile ? 'auto' : '1.5rem', fontWeight: 'bold', fontSize: '1.1rem', color: 'var(--text-primary)' }}>
                Peter Jazowick
              </div>
              <div style={{ height: isMobile ? 'auto' : '3rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                Senior Director - Technology (OTIS)
              </div>
              <div style={{ marginTop: isMobile ? '0.5rem' : '1.5rem' }}>
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: 'bold', marginBottom: '0.75rem' }}>
                  {peterTenure} Months in Role
                </div>
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '0.1rem' }}>
                  No Phone Number
                </div>
                <a href="mailto:pjazowick@pps.net" style={{ color: '#4ECDC4', textDecoration: 'underline', fontSize: '0.9rem', display: 'block' }}>
                  pjazowick@pps.net
                </a>
              </div>
            </div>
            
            <div style={{ 
              flex: 1, 
              minWidth: '200px',
              padding: '1.5rem',
              border: '1px solid var(--border-color)',
              borderRadius: '12px',
              backgroundColor: 'var(--bg-secondary)',
            }}>
              <div style={{ height: isMobile ? 'auto' : '1.5rem', fontWeight: 'bold', fontSize: '1.1rem', color: 'var(--text-primary)' }}>
                Mark Lancaster
              </div>
              <div style={{ height: isMobile ? 'auto' : '3rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                Director of IT Infrastructure
              </div>
              <div style={{ marginTop: isMobile ? '0.5rem' : '1.5rem' }}>
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: 'bold', marginBottom: '0.75rem' }}>
                  $163,092 in 2024
                </div>
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '0.1rem' }}>
                  503-916-3805
                </div>
                <a href="mailto:mlancaster@pps.net" style={{ color: '#4ECDC4', textDecoration: 'underline', fontSize: '0.9rem', display: 'block' }}>
                  mlancaster@pps.net
                </a>
              </div>
            </div>
            
            <div style={{ 
              flex: 1, 
              minWidth: '200px',
              padding: '1.5rem',
              border: '1px solid var(--border-color)',
              borderRadius: '12px',
              backgroundColor: 'var(--bg-secondary)',
            }}>
              <div style={{ height: isMobile ? 'auto' : '1.5rem', fontWeight: 'bold', fontSize: '1.1rem', color: 'var(--text-primary)' }}>
                Alicia Fecker
              </div>
              <div style={{ height: isMobile ? 'auto' : '3rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                Director of Enterprise Applications
              </div>
              <div style={{ marginTop: isMobile ? '0.5rem' : '1.5rem' }}>
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: 'bold', marginBottom: '0.75rem' }}>
                  $167,892 in 2024
                </div>
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '0.1rem' }}>
                  503-916-3917
                </div>
                <a href="mailto:afecker@pps.net" style={{ color: '#4ECDC4', textDecoration: 'underline', fontSize: '0.9rem', display: 'block' }}>
                  afecker@pps.net
                </a>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}

