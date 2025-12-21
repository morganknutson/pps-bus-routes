import { useEffect } from 'react';
import { SEO } from '../components/SEO';

export function ContactPage() {
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
      backgroundColor: '#133A60',
      minHeight: '100vh',
      color: 'white',
      padding: '4rem 2rem',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
    }}>
      <SEO title="Contact" description="Contact us about PPS Bus Routes" />
      <div style={{ maxWidth: '800px', width: '100%' }}>
        <h1 style={{ fontSize: '32px', marginBottom: '2rem' }}>Contact Us</h1>
        <p style={{ lineHeight: '1.6', color: 'rgba(255, 255, 255, 0.8)', marginBottom: '2rem' }}>
          Have questions or feedback about the bus route maps? We'd love to hear from you.
        </p>
        
        <div style={{
          backgroundColor: 'rgba(255, 255, 255, 0.05)',
          padding: '2rem',
          borderRadius: '16px',
          border: '1px solid rgba(255, 255, 255, 0.1)',
        }}>
          <p style={{ marginBottom: '1.5rem' }}>
            <strong>Official PPS Transportation:</strong><br />
            For official questions about your student's bus assignment, please contact PPS Transportation directly:
          </p>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <li>
              <i className="fas fa-phone" style={{ marginRight: '0.75rem', color: '#4ECDC4' }}></i>
              503-916-3619
            </li>
            <li>
              <i className="fas fa-envelope" style={{ marginRight: '0.75rem', color: '#4ECDC4' }}></i>
              transportation@pps.net
            </li>
            <li>
              <i className="fas fa-globe" style={{ marginRight: '0.75rem', color: '#4ECDC4' }}></i>
              <a href="https://www.pps.net/transportation" target="_blank" rel="noopener noreferrer" style={{ color: '#4ECDC4', textDecoration: 'none' }}>
                pps.net/transportation
              </a>
            </li>
          </ul>
        </div>

        <p style={{ lineHeight: '1.6', color: 'rgba(255, 255, 255, 0.6)', marginTop: '3rem' }}>
          For technical issues with this website or data corrections, please contact the development team.
        </p>
      </div>
    </div>
  );
}

