import { ReactNode, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { DarkModeToggle } from './DarkModeToggle';
import { useStore } from '../store/useStore';
import { useIsMobile } from '../hooks/useMediaQuery';
import './Header.css';

interface HeaderProps {
  rightContent?: ReactNode;
}

export function Header({ rightContent }: HeaderProps = {}) {
  const location = useLocation();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [menuOpen, setMenuOpen] = useState(false);
  const setSelectedSchool = useStore(state => state.setSelectedSchool);
  const setRoutes = useStore(state => state.setRoutes);
  
  const isHomePage = location.pathname === '/';
  const adminPaths = ['/admin', '/neighborhoods', '/tech', '/verification', '/jobs', '/servers', '/architecture'];
  const isAdminPage = adminPaths.some(path => location.pathname === path || location.pathname.startsWith(path + '/'));
  const isExplorerPage = location.pathname.startsWith('/bus-route-explorer');
  
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
          <div className="logo-container" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', paddingLeft: isMobile ? '15px' : '0' }}>
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
                style={{ color: 'white' }}
              >
                PPS Bus Routes
              </span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', paddingRight: '12px' }}>
            <div style={{ color: 'white', margin: 0, padding: 0 }}>
              <DarkModeToggle />
            </div>
            {rightContent}
            {isAdminPage && !isMobile && (
              <>
                <Link
                  to="/tech"
                  className="admin-link"
                  style={{
                    fontSize: '12px',
                    color: location.pathname.startsWith('/tech') ? 'white' : 'rgba(255, 255, 255, 0.8)',
                    textDecoration: location.pathname.startsWith('/tech') ? 'underline' : 'none',
                    fontWeight: location.pathname.startsWith('/tech') ? '600' : '400',
                    transition: 'all 0.2s',
                    cursor: 'pointer',
                  }}
                  onMouseEnter={(e) => {
                    if (!location.pathname.startsWith('/tech')) {
                      e.currentTarget.style.textDecoration = 'underline';
                      e.currentTarget.style.color = 'white';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!location.pathname.startsWith('/tech')) {
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
                    color: location.pathname.startsWith('/architecture') ? 'white' : 'rgba(255, 255, 255, 0.8)',
                    textDecoration: location.pathname.startsWith('/architecture') ? 'underline' : 'none',
                    fontWeight: location.pathname.startsWith('/architecture') ? '600' : '400',
                    transition: 'all 0.2s',
                    cursor: 'pointer',
                  }}
                  onMouseEnter={(e) => {
                    if (!location.pathname.startsWith('/architecture')) {
                      e.currentTarget.style.textDecoration = 'underline';
                      e.currentTarget.style.color = 'white';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!location.pathname.startsWith('/architecture')) {
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
                    color: location.pathname.startsWith('/servers') ? 'white' : 'rgba(255, 255, 255, 0.8)',
                    textDecoration: location.pathname.startsWith('/servers') ? 'underline' : 'none',
                    fontWeight: location.pathname.startsWith('/servers') ? '600' : '400',
                    transition: 'all 0.2s',
                    cursor: 'pointer',
                  }}
                  onMouseEnter={(e) => {
                    if (!location.pathname.startsWith('/servers')) {
                      e.currentTarget.style.textDecoration = 'underline';
                      e.currentTarget.style.color = 'white';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!location.pathname.startsWith('/servers')) {
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
                    color: location.pathname.startsWith('/verification') ? 'white' : 'rgba(255, 255, 255, 0.8)',
                    textDecoration: location.pathname.startsWith('/verification') ? 'underline' : 'none',
                    fontWeight: location.pathname.startsWith('/verification') ? '600' : '400',
                    transition: 'all 0.2s',
                    cursor: 'pointer',
                  }}
                  onMouseEnter={(e) => {
                    if (!location.pathname.startsWith('/verification')) {
                      e.currentTarget.style.textDecoration = 'underline';
                      e.currentTarget.style.color = 'white';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!location.pathname.startsWith('/verification')) {
                      e.currentTarget.style.textDecoration = 'none';
                      e.currentTarget.style.color = 'rgba(255, 255, 255, 0.8)';
                    }
                  }}
                >
                  Verification
                </Link>
                <Link
                  to="/jobs"
                  className="admin-link"
                  style={{
                    fontSize: '12px',
                    color: location.pathname.startsWith('/jobs') ? 'white' : 'rgba(255, 255, 255, 0.8)',
                    textDecoration: location.pathname.startsWith('/jobs') ? 'underline' : 'none',
                    fontWeight: location.pathname.startsWith('/jobs') ? '600' : '400',
                    transition: 'all 0.2s',
                    cursor: 'pointer',
                  }}
                  onMouseEnter={(e) => {
                    if (!location.pathname.startsWith('/jobs')) {
                      e.currentTarget.style.textDecoration = 'underline';
                      e.currentTarget.style.color = 'white';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!location.pathname.startsWith('/jobs')) {
                      e.currentTarget.style.textDecoration = 'none';
                      e.currentTarget.style.color = 'rgba(255, 255, 255, 0.8)';
                    }
                  }}
                >
                  Jobs
                </Link>
                <Link
                  to="/bus-route-explorer"
                  onClick={() => {
                    setSelectedSchool(null);
                    setRoutes([]);
                  }}
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
            {isAdminPage && isMobile && (
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'white',
                  cursor: 'pointer',
                  fontSize: '20px',
                  padding: '0.5rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                aria-label="Toggle menu"
              >
                <i className={`fas ${menuOpen ? 'fa-times' : 'fa-bars'}`}></i>
              </button>
            )}
            {isAdminPage && !isMobile && (
              <button
                onClick={handleLogout}
                style={{
                  fontSize: '12px',
                  color: 'white',
                  backgroundColor: 'transparent',
                  border: '1px solid rgba(255, 255, 255, 0.3)',
                  borderRadius: '999px',
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
      {/* Mobile Menu */}
      {isAdminPage && isMobile && menuOpen && (
        <div
          style={{
            position: 'fixed',
            top: '60px',
            left: 0,
            right: 0,
            backgroundColor: '#2d2d2d',
            zIndex: 1000,
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.3)',
            maxHeight: 'calc(var(--app-height) - 60px)',
            overflowY: 'auto',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', padding: '1rem' }}>
            <Link
              to="/tech"
              onClick={() => setMenuOpen(false)}
              style={{
                padding: '0.75rem 1rem',
                color: location.pathname.startsWith('/tech') ? 'white' : 'rgba(255, 255, 255, 0.8)',
                textDecoration: 'none',
                borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                fontWeight: location.pathname.startsWith('/tech') ? '600' : '400',
              }}
            >
              Tech
            </Link>
            <Link
              to="/architecture"
              onClick={() => setMenuOpen(false)}
              style={{
                padding: '0.75rem 1rem',
                color: location.pathname.startsWith('/architecture') ? 'white' : 'rgba(255, 255, 255, 0.8)',
                textDecoration: 'none',
                borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                fontWeight: location.pathname.startsWith('/architecture') ? '600' : '400',
              }}
            >
              Architecture
            </Link>
            <Link
              to="/servers"
              onClick={() => setMenuOpen(false)}
              style={{
                padding: '0.75rem 1rem',
                color: location.pathname.startsWith('/servers') ? 'white' : 'rgba(255, 255, 255, 0.8)',
                textDecoration: 'none',
                borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                fontWeight: location.pathname.startsWith('/servers') ? '600' : '400',
              }}
            >
              Servers
            </Link>
            <Link
              to="/verification"
              onClick={() => setMenuOpen(false)}
              style={{
                padding: '0.75rem 1rem',
                color: location.pathname.startsWith('/verification') ? 'white' : 'rgba(255, 255, 255, 0.8)',
                textDecoration: 'none',
                borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                fontWeight: location.pathname.startsWith('/verification') ? '600' : '400',
              }}
            >
              Verification
            </Link>
            <Link
              to="/jobs"
              onClick={() => setMenuOpen(false)}
              style={{
                padding: '0.75rem 1rem',
                color: location.pathname.startsWith('/jobs') ? 'white' : 'rgba(255, 255, 255, 0.8)',
                textDecoration: 'none',
                borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                fontWeight: location.pathname.startsWith('/jobs') ? '600' : '400',
              }}
            >
              Jobs
            </Link>
            <Link
              to="/bus-route-explorer"
              onClick={() => {
                setSelectedSchool(null);
                setRoutes([]);
                setMenuOpen(false);
              }}
              style={{
                padding: '0.75rem 1rem',
                color: 'rgba(255, 255, 255, 0.8)',
                textDecoration: 'none',
                borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
              }}
            >
              → Explorer
            </Link>
            {isAdminPage && (
              <button
                onClick={() => {
                  handleLogout();
                  setMenuOpen(false);
                }}
                style={{
                  marginTop: '0.5rem',
                  padding: '0.75rem 1rem',
                  fontSize: '12px',
                  color: 'white',
                  backgroundColor: 'transparent',
                  border: '1px solid rgba(255, 255, 255, 0.3)',
                  borderRadius: '999px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                }}
              >
                <i className="fas fa-sign-out-alt" />
                Logout
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
}

