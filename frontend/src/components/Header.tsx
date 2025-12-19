import { ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
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
                      location.pathname === '/servers' ||
                      location.pathname === '/architecture';
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
                <span className="logo-text" style={{ color: 'white' }}>Admin</span>
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
            {isAdminPage && (
              <>
                <Link
                  to="/tech"
                  className="admin-link"
                  style={{
                    fontSize: '12px',
                    color: location.pathname === '/tech' ? 'white' : 'rgba(255, 255, 255, 0.8)',
                    textDecoration: location.pathname === '/tech' ? 'underline' : 'none',
                    fontWeight: location.pathname === '/tech' ? '600' : '400',
                    transition: 'all 0.2s',
                    cursor: 'pointer',
                  }}
                  onMouseEnter={(e) => {
                    if (location.pathname !== '/tech') {
                      e.currentTarget.style.textDecoration = 'underline';
                      e.currentTarget.style.color = 'white';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (location.pathname !== '/tech') {
                      e.currentTarget.style.textDecoration = 'none';
                      e.currentTarget.style.color = 'rgba(255, 255, 255, 0.8)';
                    }
                  }}
                >
                  Tech
                </Link>
                <Link
                  to="/architecture"
                  className="admin-link"
                  style={{
                    fontSize: '12px',
                    color: location.pathname === '/architecture' ? 'white' : 'rgba(255, 255, 255, 0.8)',
                    textDecoration: location.pathname === '/architecture' ? 'underline' : 'none',
                    fontWeight: location.pathname === '/architecture' ? '600' : '400',
                    transition: 'all 0.2s',
                    cursor: 'pointer',
                  }}
                  onMouseEnter={(e) => {
                    if (location.pathname !== '/architecture') {
                      e.currentTarget.style.textDecoration = 'underline';
                      e.currentTarget.style.color = 'white';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (location.pathname !== '/architecture') {
                      e.currentTarget.style.textDecoration = 'none';
                      e.currentTarget.style.color = 'rgba(255, 255, 255, 0.8)';
                    }
                  }}
                >
                  Architecture
                </Link>
                <Link
                  to="/servers"
                  className="admin-link"
                  style={{
                    fontSize: '12px',
                    color: location.pathname === '/servers' ? 'white' : 'rgba(255, 255, 255, 0.8)',
                    textDecoration: location.pathname === '/servers' ? 'underline' : 'none',
                    fontWeight: location.pathname === '/servers' ? '600' : '400',
                    transition: 'all 0.2s',
                    cursor: 'pointer',
                  }}
                  onMouseEnter={(e) => {
                    if (location.pathname !== '/servers') {
                      e.currentTarget.style.textDecoration = 'underline';
                      e.currentTarget.style.color = 'white';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (location.pathname !== '/servers') {
                      e.currentTarget.style.textDecoration = 'none';
                      e.currentTarget.style.color = 'rgba(255, 255, 255, 0.8)';
                    }
                  }}
                >
                  Servers
                </Link>
                <Link
                  to="/verification"
                  className="admin-link"
                  style={{
                    fontSize: '12px',
                    color: location.pathname === '/verification' ? 'white' : 'rgba(255, 255, 255, 0.8)',
                    textDecoration: location.pathname === '/verification' ? 'underline' : 'none',
                    fontWeight: location.pathname === '/verification' ? '600' : '400',
                    transition: 'all 0.2s',
                    cursor: 'pointer',
                  }}
                  onMouseEnter={(e) => {
                    if (location.pathname !== '/verification') {
                      e.currentTarget.style.textDecoration = 'underline';
                      e.currentTarget.style.color = 'white';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (location.pathname !== '/verification') {
                      e.currentTarget.style.textDecoration = 'none';
                      e.currentTarget.style.color = 'rgba(255, 255, 255, 0.8)';
                    }
                  }}
                >
                  Verification
                </Link>
                <Link
                  to="/bus-route-explorer"
                  className="admin-link"
                  style={{
                    fontSize: '12px',
                    color: 'rgba(255, 255, 255, 0.8)',
                    textDecoration: 'none',
                    transition: 'all 0.2s',
                    cursor: 'pointer',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.textDecoration = 'underline';
                    e.currentTarget.style.color = 'white';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.textDecoration = 'none';
                    e.currentTarget.style.color = 'rgba(255, 255, 255, 0.8)';
                  }}
                >
                  → Explorer
                </Link>
              </>
            )}
            {isAdminRoute && (
              <button
                onClick={handleLogout}
                style={{
                  fontSize: '12px',
                  color: 'white',
                  backgroundColor: 'transparent',
                  border: '1px solid rgba(255, 255, 255, 0.3)',
                  borderRadius: '6px',
                  padding: '0.5rem 1rem',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.6)';
                  e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.3)';
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

