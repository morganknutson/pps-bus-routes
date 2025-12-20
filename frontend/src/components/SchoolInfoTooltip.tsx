import React from 'react';
import { School } from '../types';
import { getSchoolTypes, getSchoolColor } from '../utils/schoolUtils';
import { handleMapLinkClick } from '../utils/mapLinks';
import { formatDate } from '../utils/dateUtils';

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
  const schoolTypes = school.schoolTypes || getSchoolTypes(school.name);
  const schoolColor = getSchoolColor(schoolTypes);

  return (
    <div style={{ 
      minWidth: '200px', 
      maxWidth: '300px', 
      fontSize: '13px',
      backgroundColor: 'var(--bg-primary)',
      color: 'var(--text-primary)',
      pointerEvents: 'auto', // Allow clicks inside tooltip
    }}>
      {message ? (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          minWidth: '200px',
          padding: '0.25rem 0',
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
      ) : (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
            <h3 style={{ margin: 0, fontSize: '16px', color: 'var(--text-secondary)', flex: 1 }}>{school.name}</h3>
            {onClose && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onClose();
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '18px',
                  cursor: 'pointer',
                  color: 'var(--text-tertiary)',
                  padding: '0 0 0 0.5rem',
                  lineHeight: '1',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'color 0.2s ease',
                }}
                onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text-primary)'}
                onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-tertiary)'}
              >
                <i className="fas fa-times"></i>
              </button>
            )}
          </div>
          <div style={{ fontSize: '12px', color: schoolColor, fontWeight: '500', display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.5rem' }}>
            <i className="fas fa-graduation-cap" style={{ fontSize: '12px' }}></i>
            <span>{schoolTypes.join(' & ')}</span>
          </div>

          {school.routeCount !== undefined && (
            <div style={{ marginBottom: '0.5rem' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginBottom: '0.125rem' }}>Routes</div>
              <div style={{ fontSize: '13px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <i className="fas fa-bus" style={{ fontSize: '11px', opacity: 0.7 }}></i>
                <span>{school.routeCount} {school.routeCount === 1 ? 'route' : 'routes'} available</span>
              </div>
              {school.routesUpdatedAt && (
                <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '0.125rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <i className="fas fa-clock" style={{ fontSize: '11px', opacity: 0.7 }}></i>
                  <span>Updated {formatDate(school.routesUpdatedAt)}</span>
                </div>
              )}
            </div>
          )}

          {school.neighborhood && (
            <div style={{ marginBottom: '0.5rem' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginBottom: '0.125rem' }}>Neighborhood</div>
              <div style={{ fontSize: '13px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <i className="fas fa-map-marker-alt" style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}></i>
                <span>{school.neighborhood}</span>
              </div>
            </div>
          )}

          {school.address && (
            <div style={{ marginBottom: '0.5rem' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginBottom: '0.125rem' }}>Address</div>
              <a
                href="#"
                onClick={(e) => handleMapLinkClick(e, school.address!, school.coordinates)}
                style={{
                  fontSize: '13px',
                  color: 'var(--text-primary)',
                  textDecoration: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                }}
              >
                <i className="fas fa-directions" style={{ fontSize: '12px', opacity: 0.7 }}></i>
                <span>{school.address}</span>
              </a>
            </div>
          )}

          {(school.schoolPageLink || school.driveLink) && (
            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem', flexWrap: 'wrap', marginBottom: showRoutesButton ? '1rem' : 0 }}>
              {school.schoolPageLink && (
                <a
                  href={school.schoolPageLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    fontSize: '12px',
                    color: 'var(--text-primary)',
                    textDecoration: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.3rem',
                  }}
                >
                  <i className="fas fa-external-link-alt" style={{ fontSize: '10px' }}></i>
                  <span>School Page</span>
                </a>
              )}
              {school.driveLink && (
                <a
                  href={school.driveLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    fontSize: '12px',
                    color: 'var(--text-primary)',
                    textDecoration: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.3rem',
                  }}
                >
                  <i className="fas fa-folder" style={{ fontSize: '10px' }}></i>
                  <span>Drive Folder</span>
                </a>
              )}
            </div>
          )}

          {showRoutesButton && onViewRoutes && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onViewRoutes();
              }}
              style={{
                width: '100%',
                padding: '0.75rem',
                backgroundColor: 'var(--text-secondary)',
                color: 'var(--bg-primary)',
                border: 'none',
                borderRadius: '9999px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer',
                marginTop: '0.5rem',
                transition: 'all 0.2s ease',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.opacity = '0.9';
                e.currentTarget.style.transform = 'translateY(-1px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.opacity = '1';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              View Routes
            </button>
          )}
        </>
      )}
    </div>
  );
};

