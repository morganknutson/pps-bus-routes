import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Header } from '../components/Header';
import { SEO } from '../components/SEO';
import { useDarkMode } from '../hooks/useDarkMode';
import { Footer } from '../components/Footer';

export function ContactPage() {
  const { isDarkMode } = useDarkMode();

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
        title="Contact" 
        description="Get in touch about the PPS Bus Routes project. We welcome feedback and questions about Portland Public Schools transportation mapping." 
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
        <h1 style={{ fontSize: '32px', marginBottom: '2rem', color: 'var(--text-primary)' }}>Contact Us</h1>
        <p style={{ lineHeight: '1.6', color: 'var(--text-secondary)', marginBottom: '2rem' }}>
          Have questions or feedback about the bus route maps? We'd love to hear from you.
        </p>
        
        <div style={{
          backgroundColor: 'var(--bg-secondary)',
          padding: '2rem',
          borderRadius: '16px',
          border: '1px solid var(--border-color)',
        }}>
          <p style={{ marginBottom: '1.5rem', color: 'var(--text-primary)' }}>
            <strong>Official PPS Transportation:</strong><br />
            For official questions about your student's bus assignment, please contact PPS Transportation directly:
          </p>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <li>
              <i className="fas fa-phone" style={{ marginRight: '0.75rem', color: '#4ECDC4' }}></i>
              <span style={{ color: 'var(--text-secondary)' }}>503-916-3619</span>
            </li>
            <li>
              <i className="fas fa-envelope" style={{ marginRight: '0.75rem', color: '#4ECDC4' }}></i>
              <span style={{ color: 'var(--text-secondary)' }}>transportation@pps.net</span>
            </li>
            <li>
              <i className="fas fa-globe" style={{ marginRight: '0.75rem', color: '#4ECDC4' }}></i>
              <a href="https://www.pps.net/transportation" target="_blank" rel="noopener noreferrer" style={{ color: '#4ECDC4', textDecoration: 'none' }}>
                pps.net/transportation
              </a>
            </li>
          </ul>
        </div>

        <p style={{ lineHeight: '1.6', color: 'var(--text-tertiary)', marginTop: '3rem' }}>
          For technical issues with this website or data corrections, please contact the development team.
        </p>
      </main>

      <Footer />
    </div>
  );
}

