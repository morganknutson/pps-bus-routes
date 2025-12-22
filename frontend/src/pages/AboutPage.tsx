import { useEffect, useMemo } from 'react';
import { Header } from '../components/Header';
import { SEO } from '../components/SEO';
import { useDarkMode } from '../hooks/useDarkMode';
import { Footer } from '../components/Footer';
import { useIsMobile } from '../hooks/useMediaQuery';

import { WhoSection } from '../components/WhoSection';

export function AboutPage() {
  const { isDarkMode } = useDarkMode();
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
        maxWidth: '1000px', // Increased max-width for better grid layout
        margin: '0 auto',
        padding: '4rem 2rem',
        boxSizing: 'border-box',
      }}>
        <h1 style={{ 
          fontSize: 'var(--font-size-h1)', 
          marginBottom: '2rem', 
          color: 'var(--text-primary)',
          fontFamily: 'var(--font-family-heading)',
          fontWeight: '600'
        }}>
          About PPS Bus Routes
        </h1>
        
        <section style={{ marginBottom: '3rem' }}>
          <h3 style={{ 
            fontSize: '18px', 
            marginBottom: '1rem', 
            color: 'var(--text-primary)',
            fontFamily: 'var(--font-family-heading)',
            fontWeight: '600',
            lineHeight: '1.4'
          }}>
            What
          </h3>
          <p style={{ 
            lineHeight: '1.7', 
            color: 'var(--text-secondary)', 
            marginBottom: '1.5rem',
            fontSize: '15px',
            fontFamily: 'var(--font-family-body)'
          }}>
            PPS Bus Routes is an interactive mapping platform designed to help Portland Public Schools families navigate the district's transportation system. We take the official, often difficult-to-read route PDFs and transform them into a modern, searchable map interface.
          </p>
        </section>

        <section style={{ marginBottom: '3rem' }}>
          <h3 style={{ 
            fontSize: '18px', 
            marginBottom: '1rem', 
            color: 'var(--text-primary)',
            fontFamily: 'var(--font-family-heading)',
            fontWeight: '600',
            lineHeight: '1.4'
          }}>
            Why
          </h3>
          <p style={{ 
            lineHeight: '1.7', 
            color: 'var(--text-secondary)', 
            marginBottom: '1.5rem',
            fontSize: '15px',
            fontFamily: 'var(--font-family-body)'
          }}>
            Static PDF documents are cumbersome, especially on mobile devices. By providing a geographic view of every route and stop, we empower parents and students to quickly find their closest assigned stop, understand the full route path, and better plan their daily commutes.
          </p>
        </section>

        <section style={{ marginBottom: '3rem' }}>
          <h3 style={{ 
            fontSize: '18px', 
            marginBottom: '1rem', 
            color: 'var(--text-primary)',
            fontFamily: 'var(--font-family-heading)',
            fontWeight: '600',
            lineHeight: '1.4'
          }}>
            How
          </h3>
          <p style={{ 
            lineHeight: '1.7', 
            color: 'var(--text-secondary)', 
            marginBottom: '1.5rem',
            fontSize: '15px',
            fontFamily: 'var(--font-family-body)'
          }}>
            Our system regularly monitors the PPS website for updated transportation documents. When a new route is published, our automated pipeline extracts the stop locations, geocodes the addresses into coordinates, and plots them accurately on our interactive map.
          </p>
        </section>

        <WhoSection />
      </main>

      <Footer />
    </div>
  );
}
