import { ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ThemePicker } from './ThemePicker';
import { DarkModeToggle } from './DarkModeToggle';
import './Header.css';

interface HeaderProps {
  rightContent?: ReactNode;
}

export function Header({ rightContent }: HeaderProps = {}) {
  const location = useLocation();
  const navigate = useNavigate();
  
  const isHomePage = location.pathname === '/';
  const isAdminPage = location.pathname === '/admin' || 
                      location.pathname === '/neighborhoods' || 
                      location.pathname === '/tech' ||
                      location.pathname === '/verification' ||
                      location.pathname === '/jobs' ||
                      location.pathname === '/servers';
  const isAdminRoute = location.pathname === '/admin';
  const isExplorerPage = location.pathname === '/bus-route-explorer';
  
  const handleLogout = () => {
    sessionStorage.removeItem('adminAuthenticated');
    navigate('/');
  };
  
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
              <span 
                className="logo-text"
                style={isExplorerPage ? { color: 'white' } : {}}
              >
                Portland Public School Bus Routes
              </span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
            {isExplorerPage && (
              <div style={{ color: 'white' }}>
                <DarkModeToggle />
              </div>
            )}
            {rightContent}
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
            {isAdminRoute && (
              <button
                onClick={handleLogout}
                style={{
                  fontSize: '12px',
                  color: 'var(--text-primary)',
                  backgroundColor: 'transparent',
                  border: '1px solid var(--text-tertiary)',
                  borderRadius: '6px',
                  padding: '0.5rem 1rem',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'var(--text-secondary)';
                  e.currentTarget.style.backgroundColor = 'var(--bg-secondary)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--text-tertiary)';
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <i className="fas fa-sign-out-alt" />
                Logout
              </button>
            )}
          </div>
        </div>
      </header>
    </>
  );
}

