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
import { XIcon } from './XIcon';
import { useUrlState } from '../hooks/useUrlState';

import { Button } from './Button';

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
  if (!school) return null;

  const isMobile = useIsMobile();
  const location = useLocation();
  const isDarkMode = useStore(state => state.isDarkMode);

  const basePath = location.pathname.startsWith('/admin') ? '/admin' : '';
  const { viewSchoolRoutes } = useUrlState({ basePath });

  const schoolTypes = school.schoolTypes || getSchoolTypes(school.name);
  const schoolColor = getSchoolColor(schoolTypes);

  const handleViewRoutes = (e: React.MouseEvent) => {
    e.stopPropagation();
    viewSchoolRoutes(school.id);
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
        borderRadius: isMobile ? '0' : 'var(--radius-floating)',
        boxShadow: isMobile ? 'none' : 'var(--drop-shadow-quinary)',
        border: isMobile ? 'none' : 'none',
        padding: 'var(--floating-content-padding)',
        pointerEvents: 'auto',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: isMobile ? 'auto' : '200px' }}>
          <div style={{ width: '32px', height: '32px', borderRadius: '16px', backgroundColor: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <RouteIcon size={14} color="var(--text-tertiary)" />
          </div>
          <div style={{ fontSize: '13px', color: 'var(--text-primary)', lineHeight: '1.4', fontWeight: '600' }}>{message}</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minWidth: isMobile ? 'auto' : '280px',
      maxWidth: isMobile ? 'none' : '345px',
      width: isMobile ? '100%' : 'auto',
      backgroundColor: 'var(--bg-primary)',
      color: 'var(--text-primary)',
      borderRadius: isMobile ? '0' : 'var(--radius-floating)',
      overflow: 'hidden',
      boxShadow: isMobile ? 'none' : 'var(--drop-shadow-floating)',
      border: isMobile ? 'none' : 'none',
      pointerEvents: 'auto',
      fontFamily: "'Inter', sans-serif"
    }}>
      <div style={{
        padding: isMobile ? '8px 2rem 12px 2rem' : 'var(--floating-header-padding)',
        backgroundColor: 'var(--bg-secondary)',
        borderBottom: 'none',
        position: 'relative',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: '1rem'
      }}>
        <div style={{ flex: 1 }}>
          <h3 style={{ margin: isMobile ? '0 0 0.75rem 0' : '0 0 0.25rem 0', fontSize: isMobile ? '26px' : '18px', fontWeight: '600', letterSpacing: '-0.025em', lineHeight: '22px', color: 'var(--text-primary)' }}>
            {getSchoolDisplayName(school.name)}
          </h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem', color: schoolColor, fontSize: '12px', fontWeight: '500', marginTop: '0.2rem', marginBottom: isMobile ? '14px' : '0' }}>
            <i className="fas fa-graduation-cap" style={{ fontSize: '10px', width: '10px', flexShrink: 0 }}></i>
            <span>{schoolTypes.join(' & ')}</span>
          </div>
        </div>

        {onClose && !isMobile && (
          <button
            onClick={(e) => { e.stopPropagation(); onClose(); }}
            style={{ background: 'none', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)', cursor: 'pointer', padding: '4px', position: 'absolute', top: isMobile ? '3px' : '30px', right: isMobile ? '22px' : '34px', transition: 'color 0.2s ease', zIndex: 10, lineHeight: 1 }}
            aria-label="Close dialog"
          >
            <XIcon />
          </button>
        )}
      </div>

      <div style={{ padding: isMobile ? '1.5rem 2rem' : 'var(--floating-content-padding)' }}>
        <div style={{ display: 'grid', gap: '1rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {school.neighborhood && (
              <div style={{ fontSize: isMobile ? '16px' : '13px' }}>
                <div className="eyebrow">Neighborhood</div>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                  <div style={{ color: 'var(--text-primary)', fontWeight: '500' }}>{school.neighborhood}</div>
                </div>
              </div>
            )}

            {school.address && (
              <div style={{ fontSize: isMobile ? '16px' : '13px' }}>
                <div className="eyebrow">Address</div>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
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
              <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: '.5em' }}>
                <i className="fas fa-clock" style={{ fontSize: '12px', opacity: 0.7 }}></i>
                <span>Updated {formatDate(school.routesUpdatedAt)}</span>
              </div>
            )}
          </div>
        </div>

        {school.routeCount !== undefined && showRoutesButton && (
          <div style={{ marginLeft: '-10px', marginRight: '-10px', marginTop: '2em' }}>
            <Button
              variant="primary"
              size="large"
              fullWidth
              align="left"
              onClick={handleViewRoutes}
              icon={<RouteIcon color={school.routeCount === 0 ? '#f44' : 'currentColor'} />}
              showChevron={school.routeCount! > 0}
            >
              {school.routeCount === 0 ? 'Route information not provided' : `Explore ${school.routeCount} ${school.routeCount === 1 ? 'Route' : 'Routes'}`}
            </Button>
          </div>
        )}

        {(school.schoolPageLink || school.driveLink) && (
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', marginTop: '1rem', paddingTop: '1rem' }}>
            {school.schoolPageLink && (
              <a href={school.schoolPageLink} target="_blank" rel="noopener noreferrer" onClick={() => analyticsService.trackOutboundLink(school.schoolPageLink!, 'website')} style={{ fontSize: '11px', color: 'var(--text-tertiary)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.5em' }}>
                <i className="fas fa-link" style={{ fontSize: '11px', opacity: 0.7 }}></i>
                <span>School Website</span>
              </a>
            )}
            {school.driveLink && (
              <a href={school.driveLink} target="_blank" rel="noopener noreferrer" onClick={() => analyticsService.trackOutboundLink(school.driveLink!, 'pdf')} style={{ fontSize: '11px', color: 'var(--text-tertiary)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.5em', marginLeft: 'auto' }}>
                <i className="fas fa-folder-open" style={{ fontSize: '11px', opacity: 0.7 }}></i>
                <span>School PDFs</span>
              </a>
            )}
          </div>
        )}


      </div>
    </div>
  );
};
