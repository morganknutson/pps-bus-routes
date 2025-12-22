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
        <h1 style={{ 
          fontSize: 'var(--font-size-h1)', 
          marginBottom: '2rem', 
          color: 'var(--text-primary)',
          fontFamily: 'var(--font-family-heading)',
          fontWeight: '600'
        }}>
          Contact Us
        </h1>
        <p style={{ 
          lineHeight: 'var(--line-height-body)', 
          color: 'var(--text-secondary)', 
          marginBottom: '1rem',
          fontSize: 'var(--font-size-body)',
          fontFamily: 'var(--font-family-body)'
        }}>
          For technical issues with this website or data corrections, please contact the development team.
        </p>
        <p style={{ 
          lineHeight: 'var(--line-height-body)', 
          color: 'var(--text-secondary)', 
          marginBottom: '2rem',
          fontSize: 'var(--font-size-body)',
          fontFamily: 'var(--font-family-body)'
        }}>
          For official questions about your student's bus assignment, please contact PPS Transportation directly:
        </p>
        
        <div style={{
          backgroundColor: 'var(--bg-secondary)',
          padding: '2rem',
          borderRadius: '16px',
          border: '1px solid var(--border-color)',
        }}>
          <p style={{ 
            marginBottom: '1.5rem', 
            color: 'var(--text-primary)',
            fontFamily: 'var(--font-family-body)',
            fontSize: 'var(--font-size-body)'
          }}>
            <strong>Official PPS Transportation</strong>
          </p>
          <ul style={{ 
            listStyle: 'none', 
            padding: 0, 
            margin: 0, 
            display: 'flex', 
            flexDirection: 'column', 
            gap: '1rem',
            fontFamily: 'var(--font-family-body)',
            fontSize: 'var(--font-size-body)'
          }}>
            <li>
              <i className="fas fa-phone" style={{ marginRight: '0.75rem', color: isDarkMode ? '#FFFFFF' : 'var(--text-primary)' }}></i>
              <span style={{ color: 'var(--text-secondary)' }}>503-916-3619</span>
            </li>
            <li>
              <i className="fas fa-envelope" style={{ marginRight: '0.75rem', color: isDarkMode ? '#FFFFFF' : 'var(--text-primary)' }}></i>
              <span style={{ color: 'var(--text-secondary)' }}>transportation@pps.net</span>
            </li>
            <li>
              <i className="fas fa-globe" style={{ marginRight: '0.75rem', color: isDarkMode ? '#FFFFFF' : 'var(--text-primary)' }}></i>
              <a href="https://www.pps.net/transportation" target="_blank" rel="noopener noreferrer" style={{ color: isDarkMode ? '#FFFFFF' : 'var(--text-primary)', textDecoration: 'underline' }}>
                pps.net/transportation
              </a>
            </li>
          </ul>
        </div>

      </main>

      <Footer />
    </div>
  );
}
