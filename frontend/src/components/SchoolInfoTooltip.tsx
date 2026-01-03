import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { School } from '../types';
import { getSchoolTypes, getSchoolColor, getSchoolDisplayName } from '../utils/schoolUtils';
import { handleMapLinkClick } from '../utils/mapLinks';
import { formatDate } from '../utils/dateUtils';
import { useIsMobile } from '../hooks/useMediaQuery';
import { useStore } from '../store/useStore';
import { analyticsService } from '../services/analytics';
import { RouteIcon } from './RouteIcon';
import { MapPinIcon } from './MapPinIcon';
import { XIcon } from './XIcon';
import { parseUrlPath, buildUrlPath } from '../services/urlState';

interface SchoolInfoTooltipProps {
  school: School;
  showRoutesButton?: boolean;
  onViewRoutes?: () => void;
  onClose?: () => void;
  message?: string;
}

export const SchoolInfoTooltip: React.FC<SchoolInfoTooltipProps> = ({ 
  school, 
  showRoutesButton = false, 
  onViewRoutes,
  onClose,
  message
}) => {
  // Safety check: return null if school is undefined
  if (!school) {
    return null;
  }

  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const location = useLocation();
  const isDarkMode = useStore(state => state.isDarkMode);
  const schoolTypes = school.schoolTypes || getSchoolTypes(school.name);
  const schoolColor = getSchoolColor(schoolTypes);

  const handleViewRoutes = (e: React.MouseEvent) => {
    e.stopPropagation();
    const basePath = location.pathname.startsWith('/admin') ? '/admin' : '';
    const urlState = parseUrlPath(location.pathname, basePath);
    const newState = {
      ...urlState,
      schoolId: school.id,
      show: 'routes' as const,
      focus: undefined // Clear school-info focus when exploring routes
    };
    navigate(buildUrlPath(basePath, newState));
    if (onViewRoutes) onViewRoutes();
  };

  if (message) {
    return (
      <div style={{ 
        minWidth: isMobile ? 'auto' : '200px', 
        maxWidth: isMobile ? 'none' : '300px', 
        width: isMobile ? '100%' : 'auto',
        fontSize: '13px',
        backgroundColor: 'var(--bg-primary)',
        color: 'var(--text-primary)',
        borderRadius: isMobile ? '0' : '12px',
        boxShadow: isMobile ? 'none' : '0 4px 12px var(--shadow-hover)',
        border: isMobile ? 'none' : '1px solid var(--border-color)',
        padding: '0.5rem 1rem',
        pointerEvents: 'auto', // Allow clicks inside tooltip
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          minWidth: isMobile ? 'auto' : '200px',
        }}>
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '16px',
            backgroundColor: 'var(--bg-tertiary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}>
            <RouteIcon size={14} color="var(--text-tertiary)" />
          </div>
          <div style={{ 
            fontSize: '13px', 
            color: 'var(--text-primary)', 
            lineHeight: '1.4',
            fontWeight: '600'
          }}>
            {message}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ 
      minWidth: isMobile ? 'auto' : '280px', 
      maxWidth: isMobile ? 'none' : '320px', 
      width: isMobile ? '100%' : 'auto',
      backgroundColor: 'var(--bg-primary)',
      color: 'var(--text-primary)',
      borderRadius: isMobile ? '0' : '16px',
      overflow: 'hidden',
      boxShadow: isMobile ? 'none' : '0 10px 25px rgba(0, 0, 0, 0.2)',
      border: isMobile ? 'none' : '1px solid var(--border-color-darker)',
      pointerEvents: 'auto',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      {/* Header with School Name & Type */}
      <div style={{ 
        padding: isMobile ? '8px 2rem 12px 2rem' : '12px 1.25rem',
        backgroundColor: 'var(--bg-secondary)', 
        borderBottom: '1px solid var(--border-color)',
        position: 'relative',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: '1rem'
      }}>
        <div style={{ flex: 1 }}>
          <h3 style={{ 
            margin: '0 0 0.25rem 0', 
            fontSize: isMobile ? '26px' : '18px', 
            fontWeight: '600',
            lineHeight: '1.2',
            color: 'var(--text-primary)' 
          }}>
            {getSchoolDisplayName(school.name)}
          </h3>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '0.375rem',
            color: schoolColor,
            fontSize: '12px',
            fontWeight: '500',
            marginTop: '0.2rem',
            marginBottom: isMobile ? '14px' : '0'
          }}>
            <i className="fas fa-graduation-cap" style={{ fontSize: '10px', width: '10px', flexShrink: 0 }}></i>
            <span>{schoolTypes.join(' & ')}</span>
          </div>
        </div>

        {onClose && (
          <button
            onClick={(e) => { e.stopPropagation(); onClose(); }}
            style={{
              background: 'none',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-tertiary)',
              cursor: 'pointer',
              padding: '4px',
              position: 'absolute',
              top: isMobile ? '3px' : '14px',
              right: isMobile ? '22px' : '18px',
              transition: 'color 0.2s ease',
              zIndex: 10,
              lineHeight: 1
            }}
            onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text-primary)'}
            onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-tertiary)'}
            aria-label="Close dialog"
          >
            <XIcon />
          </button>
        )}
      </div>

      <div style={{ padding: isMobile ? '1.5rem 2rem' : '1.25rem' }}>
        {/* Details Grid */}
        <div style={{ display: 'grid', gap: '1rem' }}>
          {/* Neighborhood & Address */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {school.neighborhood && (
              <div style={{ fontSize: isMobile ? '16px' : '13px' }}>
                <div style={{ color: 'var(--text-tertiary)', fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', marginBottom: '5px' }}>Neighborhood</div>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                  <i className="fas fa-city" style={{ fontSize: isMobile ? '11px' : '9px', color: 'var(--text-tertiary)', flexShrink: 0, marginTop: isMobile ? '5px' : '4px' }}></i>
                  <div style={{ color: 'var(--text-primary)', fontWeight: '500' }}>{school.neighborhood}</div>
                </div>
              </div>
            )}

            {school.address && (
              <div style={{ fontSize: isMobile ? '16px' : '13px' }}>
                <div style={{ color: 'var(--text-tertiary)', fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', marginBottom: '5px' }}>Address</div>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                  <MapPinIcon width={isMobile ? 11 : 9} height={isMobile ? 15 : 13} style={{ flexShrink: 0, color: 'var(--text-tertiary)', marginTop: isMobile ? '4px' : '2px' }} />
                  <a
                    href="#"
                    onClick={(e) => {
                      analyticsService.trackOutboundLink(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(school.address!)}`, 'maps');
                      handleMapLinkClick(e, school.address!, school.coordinates);
                    }}
                    style={{ color: 'var(--text-primary)', textDecoration: 'none', fontWeight: '500', display: 'block' }}
                  >
                    {school.address}
                  </a>
                </div>
              </div>
            )}

            {school.routesUpdatedAt && (
              <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <i className="fas fa-clock" style={{ fontSize: '10px', opacity: 0.7 }}></i>
                <span>Updated {formatDate(school.routesUpdatedAt)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Action Links */}
        {(school.schoolPageLink || school.driveLink) && (
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between',
            gap: '1rem', 
            marginTop: '1.25rem',
            paddingTop: '1rem',
            borderTop: '1px solid var(--border-color)'
          }}>
            {school.schoolPageLink && (
              <a
                href={school.schoolPageLink}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => analyticsService.trackOutboundLink(school.schoolPageLink!, 'website')}
                style={{ fontSize: '12px', color: 'var(--text-secondary)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
              >
                <i className="fas fa-link"></i>
                <span>Website</span>
              </a>
            )}
            {school.driveLink && (
              <a
                href={school.driveLink}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => analyticsService.trackOutboundLink(school.driveLink!, 'pdf')}
                style={{ fontSize: '12px', color: 'var(--text-secondary)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.4rem', marginLeft: 'auto' }}
              >
                <i className="fas fa-folder-open"></i>
                <span>Files</span>
              </a>
            )}
          </div>
        )}

        {/* Unified Routes Action Button */}
        {school.routeCount !== undefined && showRoutesButton && (
          <button
            onClick={handleViewRoutes}
            style={{ 
              display: 'flex', 
              gap: '0.75rem', 
              padding: '8px 16px 8px 8px',
              backgroundColor: school.routeCount === 0 
                ? (isDarkMode ? 'rgba(244, 67, 54, 0.1)' : 'rgba(244, 67, 54, 0.05)')
                : (isDarkMode ? 'var(--bg-tertiary)' : 'var(--brand-primary)'),
              borderRadius: '9999px',
              border: school.routeCount === 0
                ? `1px solid ${isDarkMode ? 'rgba(244, 67, 54, 0.3)' : 'rgba(244, 67, 54, 0.2)'}`
                : (isDarkMode ? '1px solid var(--border-color)' : 'none'),
              textAlign: 'left',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              width: '100%',
              alignItems: 'center',
              marginTop: '1.25rem',
              boxShadow: school.routeCount === 0 ? 'none' : (isDarkMode ? '0 1px 3px var(--shadow-large)' : '0 2px 8px rgba(19, 58, 96, 0.2)')
            }}
            onMouseEnter={(e) => {
              if (school.routeCount! > 0) {
                e.currentTarget.style.backgroundColor = isDarkMode ? 'var(--bg-secondary)' : '#1a4b7c';
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow = isDarkMode ? '0 4px 12px rgba(0, 0, 0, 0.1)' : '0 4px 12px rgba(19, 58, 96, 0.3)';
              } else {
                e.currentTarget.style.backgroundColor = isDarkMode ? 'rgba(244, 67, 54, 0.15)' : 'rgba(244, 67, 54, 0.1)';
              }
            }}
            onMouseLeave={(e) => {
              if (school.routeCount! > 0) {
                e.currentTarget.style.backgroundColor = isDarkMode ? 'var(--bg-tertiary)' : 'var(--brand-primary)';
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = isDarkMode ? '0 1px 3px var(--shadow-large)' : '0 2px 8px rgba(19, 58, 96, 0.2)';
              } else {
                e.currentTarget.style.backgroundColor = isDarkMode ? 'rgba(244, 67, 54, 0.1)' : 'rgba(244, 67, 54, 0.05)';
              }
            }}
          >
            <div style={{ 
              width: '28px', 
              height: '28px', 
              backgroundColor: school.routeCount === 0
                ? 'rgba(244, 67, 54, 0.2)'
                : (isDarkMode ? 'var(--bg-primary)' : 'rgba(255, 255, 255, 0.2)'), 
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              boxShadow: isDarkMode ? '0 2px 4px rgba(0,0,0,0.05)' : 'none'
            }}>
              <RouteIcon size={13} color={school.routeCount === 0 ? '#f44' : (isDarkMode ? schoolColor : '#ffffff')} />
            </div>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ 
                fontSize: '13px', 
                fontWeight: '700', 
                color: school.routeCount === 0 ? '#f44' : (isDarkMode ? 'var(--text-primary)' : '#ffffff'),
                lineHeight: '1.2'
              }}>
                {school.routeCount === 0 
                  ? 'Route information not provided on the web' 
                  : `Explore ${school.routeCount} ${school.routeCount === 1 ? 'Route' : 'Routes'}`}
              </div>
              {school.routeCount! > 0 && (
                <svg 
                  width="16" 
                  height="16" 
                  viewBox="0 0 24 24" 
                  fill="none" 
                  stroke="currentColor" 
                  strokeWidth="1.5" 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  style={{ opacity: 0.6, marginLeft: '0.5rem' }}
                >
                  <polyline points="9 18 15 12 9 6"></polyline>
                </svg>
              )}
            </div>
          </button>
        )}
      </div>
    </div>
  );
};
