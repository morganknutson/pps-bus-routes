import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useDarkMode } from '../hooks/useDarkMode';
import './Header.css';

export function Header() {
  const { isDarkMode, toggleDarkMode } = useDarkMode();
  const location = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  
  const isHomePage = location.pathname === '/';
  const isAdminPage = location.pathname === '/admin' || 
                      location.pathname === '/neighborhoods' || 
                      location.pathname === '/tech' ||
                      location.pathname === '/verification' ||
                      location.pathname === '/jobs' ||
                      location.pathname === '/servers';

  // Prevent body scroll when sidebar is open and add class for content shifting
  useEffect(() => {
    if (isMenuOpen) {
      document.body.style.overflow = 'hidden';
      document.body.classList.add('menu-open');
    } else {
      document.body.style.overflow = '';
      document.body.classList.remove('menu-open');
    }
    return () => {
      document.body.style.overflow = '';
      document.body.classList.remove('menu-open');
    };
  }, [isMenuOpen]);

  // Close menu when route changes
  useEffect(() => {
    setIsMenuOpen(false);
  }, [location.pathname]);
  
  // Don't show header on home page
  if (isHomePage) {
    return null;
  }

  return (
    <>
      {/* Sidebar */}
      <nav className={`sidebar-menu ${isMenuOpen ? 'sidebar-open' : ''}`}>
        <div className="sidebar-header">
          <button
            onClick={() => setIsMenuOpen(false)}
            className="sidebar-close-button"
            aria-label="Close menu"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '0.5rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-primary)',
              transition: 'background-color 0.2s ease',
              borderRadius: '4px',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--bg-secondary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            <i className="fas fa-times" style={{ fontSize: '1.25rem' }} />
          </button>
        </div>
        <div className="sidebar-content">
          {isAdminPage ? (
            <>
              <Link 
                to="/neighborhoods" 
                className={`sidebar-nav-link ${location.pathname === '/neighborhoods' ? 'sidebar-nav-link-active' : ''}`}
                onClick={() => setIsMenuOpen(false)}
              >
                Neighborhoods
              </Link>
              <Link 
                to="/tech" 
                className={`sidebar-nav-link ${location.pathname === '/tech' ? 'sidebar-nav-link-active' : ''}`}
                onClick={() => setIsMenuOpen(false)}
              >
                Tech
              </Link>
              <Link 
                to="/verification" 
                className={`sidebar-nav-link ${location.pathname === '/verification' ? 'sidebar-nav-link-active' : ''}`}
                onClick={() => setIsMenuOpen(false)}
              >
                Verification
              </Link>
              <Link 
                to="/jobs" 
                className={`sidebar-nav-link ${location.pathname === '/jobs' ? 'sidebar-nav-link-active' : ''}`}
                onClick={() => setIsMenuOpen(false)}
              >
                Jobs
              </Link>
              <Link 
                to="/servers" 
                className={`sidebar-nav-link ${location.pathname === '/servers' ? 'sidebar-nav-link-active' : ''}`}
                onClick={() => setIsMenuOpen(false)}
              >
                Servers
              </Link>
            </>
          ) : (
            <>
              <a 
                href="#info" 
                className="sidebar-nav-link"
                onClick={() => setIsMenuOpen(false)}
              >
                Info
              </a>
              <a 
                href="#error" 
                className="sidebar-nav-link"
                onClick={() => setIsMenuOpen(false)}
              >
                Found an Error
              </a>
            </>
          )}
        </div>
      </nav>

      <header className={`app-header ${isAdminPage ? 'sticky-header' : ''}`}>
        <div className="header-content">
          <div className="logo-container" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            {/* Hamburger button */}
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="hamburger-button"
              aria-label="Toggle menu"
              aria-expanded={isMenuOpen}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '0.5rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text-primary)',
                transition: 'background-color 0.2s ease, opacity 0.2s ease',
                borderRadius: '4px',
                visibility: isMenuOpen ? 'hidden' : 'visible',
                opacity: isMenuOpen ? 0 : 1,
              }}
              onMouseEnter={(e) => {
                if (!isMenuOpen) {
                  e.currentTarget.style.backgroundColor = 'var(--bg-secondary)';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              <i 
                className="fas fa-bars"
                style={{ fontSize: '1.25rem' }}
              />
            </button>

            <div className="mock-logo">🚌</div>
            {isAdminPage ? (
              <Link
                to="/admin"
                style={{
                  textDecoration: 'none',
                  color: 'inherit',
                }}
              >
                <span className="logo-text">Admin</span>
              </Link>
            ) : (
              <span className="logo-text">Portland Public School Bus Routes</span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
            <button
              onClick={toggleDarkMode}
              className="dark-mode-toggle"
              aria-label={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
              title={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              <i 
                className={`fas ${isDarkMode ? 'fa-sun' : 'fa-moon'}`}
                style={{ color: 'var(--text-primary)', fontSize: '12px' }}
              ></i>
            </button>
            <Link
              to={isAdminPage ? "/bus-route-explorer" : "/admin"}
              className="admin-link"
              style={{
                fontSize: '12px',
                color: 'var(--text-primary)',
                textDecoration: 'none',
                transition: 'all 0.2s',
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.textDecoration = 'underline';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.textDecoration = 'none';
              }}
            >
              → {isAdminPage ? 'Explorer' : 'Admin'}
            </Link>
          </div>
        </div>
      </header>
    </>
  );
}

