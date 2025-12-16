import { Link, useLocation } from 'react-router-dom';
import { ThemePicker } from './ThemePicker';
import './Header.css';

export function Header() {
  const location = useLocation();
  
  const isHomePage = location.pathname === '/';
  const isAdminPage = location.pathname === '/admin' || 
                      location.pathname === '/neighborhoods' || 
                      location.pathname === '/tech' ||
                      location.pathname === '/verification' ||
                      location.pathname === '/jobs' ||
                      location.pathname === '/servers';
  
  // Don't show header on home page
  if (isHomePage) {
    return null;
  }

  return (
    <>
      <header className={`app-header ${isAdminPage ? 'sticky-header' : ''}`}>
        <div className="header-content">
          <div className="logo-container" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
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
            {isAdminPage && <ThemePicker />}
            {isAdminPage && (
              <Link
                to="/bus-route-explorer"
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
                → Explorer
              </Link>
            )}
          </div>
        </div>
      </header>
    </>
  );
}

