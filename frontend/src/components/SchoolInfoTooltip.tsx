import React from 'react';
import { School } from '../types';
import { getSchoolTypes, getSchoolColor } from '../utils/schoolUtils';
import { handleMapLinkClick } from '../utils/mapLinks';
import { formatDate } from '../utils/dateUtils';
import { useIsMobile } from '../hooks/useMediaQuery';

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
  const isMobile = useIsMobile();
  const schoolTypes = school.schoolTypes || getSchoolTypes(school.name);
  const schoolColor = getSchoolColor(schoolTypes);

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
            <i className="fas fa-route" style={{ color: 'var(--text-tertiary)', fontSize: '14px' }}></i>
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
      border: isMobile ? 'none' : '1px solid var(--border-color)',
      pointerEvents: 'auto',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      {/* Header with School Name & Type */}
      <div style={{ 
        padding: isMobile ? '24px 2rem 12px 2rem' : '12px 1.25rem',
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
            fontSize: '16px', 
            fontWeight: '700',
            lineHeight: '1.2',
            color: 'var(--text-primary)' 
          }}>
            {school.name}
          </h3>
          <div style={{ 
            display: 'inline-flex', 
            alignItems: 'center', 
            gap: '0.4rem',
            padding: '2px 8px',
            backgroundColor: `${schoolColor}15`,
            color: schoolColor,
            borderRadius: '20px',
            fontSize: '10px',
            fontWeight: '700',
            textTransform: 'uppercase',
            letterSpacing: '0.02em'
          }}>
            <i className="fas fa-graduation-cap" style={{ fontSize: '9px' }}></i>
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
              fontSize: '24px',
              padding: '4px',
              position: 'absolute',
              top: isMobile ? '-3px' : '8px',
              right: isMobile ? '22px' : '18px',
              transition: 'color 0.2s ease',
              zIndex: 10,
              fontWeight: 200,
              lineHeight: 1
            }}
            onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text-primary)'}
            onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-tertiary)'}
          >
            ×
          </button>
        )}
      </div>

      <div style={{ padding: isMobile ? '1.5rem 2rem' : '1.25rem' }}>
        {/* Details Grid */}
        <div style={{ display: 'grid', gap: '1rem' }}>
          {/* Neighborhood & Address */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {school.neighborhood && (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                <div style={{ fontSize: '13px' }}>
                  <div style={{ color: 'var(--text-tertiary)', fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', marginBottom: '2px' }}>Neighborhood</div>
                  <div style={{ color: 'var(--text-primary)', fontWeight: '500' }}>{school.neighborhood}</div>
                </div>
              </div>
            )}

            {school.address && (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                <div style={{ fontSize: '13px' }}>
                  <div style={{ color: 'var(--text-tertiary)', fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', marginBottom: '2px' }}>Address</div>
                  <a
                    href="#"
                    onClick={(e) => handleMapLinkClick(e, school.address!, school.coordinates)}
                    style={{ color: 'var(--text-primary)', textDecoration: 'none', fontWeight: '500', display: 'block', marginTop: '1px' }}
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
                style={{ fontSize: '12px', color: 'var(--text-secondary)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
              >
                <i className="fas fa-folder-open"></i>
                <span>Files</span>
              </a>
            )}
          </div>
        )}

        {/* Unified Routes Action Button */}
        {school.routeCount !== undefined && (
          <button
            onClick={(e) => {
              if (showRoutesButton && onViewRoutes) {
                e.stopPropagation();
                onViewRoutes();
              }
            }}
            disabled={!showRoutesButton || !onViewRoutes}
            style={{ 
              display: 'flex', 
              gap: '0.75rem', 
              padding: '8px 16px',
              backgroundColor: 'var(--bg-tertiary)',
              borderRadius: '9999px',
              border: '1px solid var(--border-color)',
              textAlign: 'left',
              cursor: (showRoutesButton && onViewRoutes) ? 'pointer' : 'default',
              transition: 'all 0.2s ease',
              width: '100%',
              alignItems: 'center',
              marginTop: '1.25rem',
              boxShadow: '0 1px 3px var(--shadow-large)'
            }}
            onMouseEnter={(e) => {
              if (showRoutesButton && onViewRoutes) {
                e.currentTarget.style.backgroundColor = 'var(--bg-secondary)';
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.1)';
              }
            }}
            onMouseLeave={(e) => {
              if (showRoutesButton && onViewRoutes) {
                e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)';
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 1px 3px var(--shadow-large)';
              }
            }}
          >
            <div style={{ 
              width: '28px', 
              height: '28px', 
              backgroundColor: 'var(--bg-primary)', 
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
            }}>
              <i className="fas fa-route" style={{ color: schoolColor, fontSize: '13px' }}></i>
            </div>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ 
                fontSize: '13px', 
                fontWeight: '700', 
                color: 'var(--text-primary)',
              }}>
                Explore {school.routeCount} {school.routeCount === 1 ? 'Route' : 'Routes'}
              </div>
              {(showRoutesButton && onViewRoutes) && (
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
