import { useEffect } from 'react';
import { SEO } from '../components/SEO';

export function AboutPage() {
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
      backgroundColor: 'var(--brand-primary)',
      minHeight: '100vh',
      color: 'white',
      padding: '4rem 2rem',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
    }}>
      <SEO title="About" description="About Portland Public Schools Bus Routes" />
      <div style={{ maxWidth: '800px', width: '100%' }}>
        <h1 style={{ fontSize: '32px', marginBottom: '2rem' }}>About PPS Bus Routes</h1>
        <p style={{ lineHeight: '1.6', color: 'rgba(255, 255, 255, 0.8)', marginBottom: '1.5rem' }}>
          This application provides an interactive way for parents and students to find and visualize Portland Public Schools bus routes and stops.
        </p>
        <p style={{ lineHeight: '1.6', color: 'rgba(255, 255, 255, 0.8)', marginBottom: '1.5rem' }}>
          Our goal is to make transportation information more accessible by transforming static PDF documents into interactive, searchable maps.
        </p>
        <h2 style={{ fontSize: '24px', marginTop: '3rem', marginBottom: '1.5rem' }}>How it works</h2>
        <p style={{ lineHeight: '1.6', color: 'rgba(255, 255, 255, 0.8)', marginBottom: '1.5rem' }}>
          We regularly fetch the latest transportation schedules from PPS, parse the stop locations, and geocode them to display on the map. You can search by home address to find your closest assigned stop.
        </p>
        <p style={{ lineHeight: '1.6', color: 'rgba(255, 255, 255, 0.4)', marginTop: '4rem', fontSize: '14px' }}>
          Disclaimer: This is not an official Portland Public Schools website. Always refer to official PPS transportation communications for final route information.
        </p>
      </div>
    </div>
  );
}

