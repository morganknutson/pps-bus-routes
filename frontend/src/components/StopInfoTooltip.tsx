import React from 'react';
import { Route, Stop } from '../types';
import { formatStreetName, extractStreetNames } from '../utils/formatAddress';

interface StopInfoTooltipProps {
  route: Route;
  stop: Stop;
  stopNumber: number;
  enableStreetHighlighting?: boolean;
  highlightedStreetName?: string;
  loadingStreet?: string;
  streetError?: string;
  onStreetClick?: (streetName: string) => void;
  onClose: () => void;
  // Admin features
  enableStreetPins?: boolean;
  loadingStreetPins?: boolean;
  onDropStreetPins?: () => void;
  editingMode?: boolean;
  undoHistoryCount?: number;
  onUndo?: () => void;
}

export const StopInfoTooltip: React.FC<StopInfoTooltipProps> = ({
  route,
  stop,
  stopNumber,
  enableStreetHighlighting = false,
  highlightedStreetName,
  loadingStreet,
  streetError,
  onStreetClick,
  onClose,
  enableStreetPins = false,
  loadingStreetPins = false,
  onDropStreetPins,
  editingMode = false,
  undoHistoryCount = 0,
  onUndo,
}) => {
  const streets = extractStreetNames(stop.address);

  return (
    <div style={{ 
      minWidth: '250px', 
      maxWidth: '350px', 
      fontSize: '13px',
      backgroundColor: 'var(--bg-primary)',
      color: 'var(--text-primary)',
      pointerEvents: 'auto',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 'bold', fontSize: '18px', color: 'var(--text-primary)' }}>{route.name}</span>
          {stopNumber > 0 && (
            <span style={{ 
              fontSize: '11px', 
              padding: '2px 8px',
              borderRadius: '10px',
              fontWeight: '600',
              backgroundColor: route.color,
              color: '#FFFFFF',
            }}>
              Stop {stopNumber}
            </span>
          )}
        </div>
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
      </div>

      {stop.isSchoolStop && (
        <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
          <i className="fas fa-school" style={{ fontSize: '11px' }}></i>
          <span>School Loading Zone</span>
        </div>
      )}

      <div style={{ fontSize: '14px', fontWeight: '500', marginBottom: '0.5rem', color: 'var(--text-primary)', lineHeight: '1.4' }}>
        {stop.isSchoolStop && stop.schoolName ? (
          stop.schoolName
        ) : enableStreetHighlighting && streets.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            {streets.map((streetName, index) => {
              const isHighlighted = highlightedStreetName === streetName;
              const isLoading = loadingStreet === streetName;
              
              return (
                <div key={index} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  {index > 0 && <span style={{ color: 'var(--text-tertiary)', fontSize: '12px' }}>&</span>}
                  <span
                    onClick={() => !isLoading && onStreetClick?.(streetName)}
                    style={{
                      cursor: isLoading ? 'not-allowed' : 'pointer',
                      textDecoration: 'none',
                      color: isHighlighted ? '#FFD700' : isLoading ? 'var(--text-tertiary)' : 'var(--text-primary)',
                      fontWeight: isHighlighted ? 'bold' : 'normal',
                      opacity: isLoading ? 0.6 : 1,
                      transition: 'all 0.2s ease',
                    }}
                    onMouseEnter={(e) => {
                      if (!isLoading) e.currentTarget.style.color = '#4ECDC4';
                    }}
                    onMouseLeave={(e) => {
                      if (!isLoading) e.currentTarget.style.color = isHighlighted ? '#FFD700' : 'var(--text-primary)';
                    }}
                  >
                    {formatStreetName(streetName)}
                    {isLoading && (
                      <i className="fas fa-circle-notch fa-spin" style={{ marginLeft: '0.4rem', fontSize: '10px' }}></i>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          formatStreetName(stop.address)
        )}
      </div>

      {stop.time && (
        <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <i className="fas fa-clock" style={{ fontSize: '11px', opacity: 0.7 }}></i>
          <span>{stop.time}</span>
        </div>
      )}

      {stop.neighborhood && (
        <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginBottom: '0.5rem' }}>
          {stop.neighborhood}
        </div>
      )}

      {streetError && (
        <div style={{ 
          fontSize: '11px', 
          color: '#f44336', 
          marginTop: '0.5rem',
          padding: '0.4rem 0.6rem',
          backgroundColor: 'rgba(244, 67, 54, 0.1)',
          borderRadius: '4px',
          display: 'flex',
          alignItems: 'center',
          gap: '0.4rem',
        }}>
          <i className="fas fa-exclamation-triangle"></i>
          <span>{streetError}</span>
        </div>
      )}

      {/* Admin actions */}
      {(enableStreetPins || (editingMode && undoHistoryCount > 0)) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.75rem' }}>
          {enableStreetPins && !stop.isSchoolStop && streets.length > 0 && (
            <button
              onClick={onDropStreetPins}
              disabled={loadingStreetPins}
              style={{
                width: '100%',
                background: loadingStreetPins ? 'var(--bg-tertiary)' : '#4ECDC4',
                border: 'none',
                fontSize: '12px',
                cursor: loadingStreetPins ? 'not-allowed' : 'pointer',
                color: 'white',
                padding: '0.5rem',
                borderRadius: '4px',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                opacity: loadingStreetPins ? 0.6 : 1,
                transition: 'all 0.2s ease',
              }}
            >
              {loadingStreetPins ? (
                <i className="fas fa-circle-notch fa-spin"></i>
              ) : (
                <i className="fas fa-map-marker-alt"></i>
              )}
              <span>{loadingStreetPins ? 'Dropping pins...' : 'Drop Pins on Streets'}</span>
            </button>
          )}

          {editingMode && undoHistoryCount > 0 && (
            <button
              onClick={onUndo}
              style={{
                width: '100%',
                background: 'var(--bg-tertiary)',
                border: `1px solid var(--border-color)`,
                fontSize: '12px',
                cursor: 'pointer',
                color: 'var(--text-primary)',
                padding: '0.5rem',
                borderRadius: '4px',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                transition: 'all 0.2s ease',
              }}
            >
              <i className="fas fa-undo"></i>
              <span>Undo Changes ({undoHistoryCount})</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
};

