import { Link, useLocation } from 'react-router-dom';
import { useDarkMode } from '../hooks/useDarkMode';
import './Header.css';

export function Header() {
  const { isDarkMode, toggleDarkMode } = useDarkMode();
  const location = useLocation();
  const isAdminPage = location.pathname === '/admin' || 
                      location.pathname === '/neighborhoods' || 
                      location.pathname === '/data/schools' ||
                      location.pathname === '/tech';
  const isMainAdminPage = location.pathname === '/admin';
  const isAdminSubPage = isAdminPage && !isMainAdminPage;

  return (
    <header className="app-header">
      <div className="header-content">
        <div className="logo-container">
          <div className="mock-logo">🚌</div>
          <span className="logo-text">
            {isAdminPage ? 'Admin' : 'Portland Public School Bus Routes'}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
          <nav className="header-nav">
            {isAdminPage ? (
              <>
                <Link 
                  to="/neighborhoods" 
                  className={`nav-link ${location.pathname === '/neighborhoods' ? 'nav-link-active' : ''}`}
                >
                  Neighborhoods
                </Link>
                <Link 
                  to="/tech" 
                  className={`nav-link ${location.pathname === '/tech' ? 'nav-link-active' : ''}`}
                >
                  Tech
                </Link>
              </>
            ) : (
              <>
                <a href="#info" className="nav-link">Info</a>
                <a href="#error" className="nav-link">Found an Error</a>
              </>
            )}
          </nav>
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
            to={isMainAdminPage ? "/" : "/admin"}
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
            {isMainAdminPage ? '→ Map' : '→ Admin'}
          </Link>
        </div>
      </div>
    </header>
  );
}

