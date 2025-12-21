import React, { useState } from 'react';
import { Route, Stop } from '../types';
import { formatStreetName, extractStreetNames } from '../utils/formatAddress';
import { handleMapLinkClick } from '../utils/mapLinks';

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

interface StopPillProps {
  number: number;
  time?: string;
  color: string;
}

const StopPill: React.FC<StopPillProps> = ({ number, time, color }) => {
  const hasTime = !!time && time.trim().length > 0;
  
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      height: '24px',
    }}>
      <div style={{
        width: '20px',
        height: '20px',
        backgroundColor: color,
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'white',
        fontSize: '11px',
        fontWeight: 'bold',
        boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
      }}>
        {number}
      </div>
      {hasTime && (
        <span style={{ 
          whiteSpace: 'nowrap', 
          fontSize: '13px', 
          fontWeight: '600', 
          color: 'var(--text-primary)' 
        }}>
          {time}
        </span>
      )}
    </div>
  );
};

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
  const [copied, setCopied] = useState(false);
  const streets = extractStreetNames(stop.address);
  const formattedAddress = formatStreetName(stop.address);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(stop.address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{ 
      minWidth: '280px', 
      maxWidth: '350px', 
      backgroundColor: 'var(--bg-primary)',
      color: 'var(--text-primary)',
      borderRadius: '12px',
      overflow: 'hidden',
      boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
      border: '1px solid var(--border-color)',
      pointerEvents: 'auto',
    }}>
      {/* Header with Route Info */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'flex-start', 
        padding: '12px 16px',
        borderBottom: '1px solid var(--border-color)',
        backgroundColor: 'var(--bg-secondary)',
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '8px' }}>
          <span style={{ fontWeight: '700', fontSize: '15px' }}>Route {route.name}</span>
          {stopNumber > 0 && (
            <StopPill number={stopNumber} time={stop.time} color={route.color} />
          )}
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onClose(); }}
          style={{
            background: 'none',
            border: 'none',
            fontSize: '14px',
            cursor: 'pointer',
            color: 'var(--text-tertiary)',
            padding: '2px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'color 0.2s ease',
            marginTop: '2px',
          }}
          onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text-primary)'}
          onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-tertiary)'}
        >
          <i className="fas fa-times"></i>
        </button>
      </div>

      {/* Main Content */}
      <div style={{ padding: '20px 16px' }}>
        {/* Details Grid */}
        <div style={{ display: 'grid', gap: '1rem' }}>
          {/* Address & Neighborhood */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ fontSize: '13px' }}>
              <div style={{ color: 'var(--text-tertiary)', fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', marginBottom: '2px' }}>Address</div>
              <div style={{ color: 'var(--text-primary)', fontWeight: '500', lineHeight: '1.4' }}>
                {stop.isSchoolStop && stop.schoolName ? (
                  stop.schoolName
                ) : enableStreetHighlighting && streets.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {streets.map((streetName, index) => {
                      const isHighlighted = highlightedStreetName === streetName;
                      const isLoading = loadingStreet === streetName;
                      
                      return (
                        <div key={index} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          {index > 0 && <span style={{ color: 'var(--text-tertiary)', fontSize: '12px' }}>&</span>}
                          <span
                            onClick={() => !isLoading && onStreetClick?.(streetName)}
                            style={{
                              cursor: isLoading ? 'not-allowed' : 'pointer',
                              color: isHighlighted ? '#FFD700' : isLoading ? 'var(--text-tertiary)' : 'var(--text-primary)',
                              transition: 'color 0.2s ease',
                            }}
                            onMouseEnter={(e) => { if (!isLoading) e.currentTarget.style.color = route.color; }}
                            onMouseLeave={(e) => { if (!isLoading) e.currentTarget.style.color = isHighlighted ? '#FFD700' : 'var(--text-primary)'; }}
                          >
                            {formatStreetName(streetName)}
                            {isLoading && <i className="fas fa-circle-notch fa-spin" style={{ marginLeft: '6px', fontSize: '10px' }}></i>}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  formattedAddress
                )}
              </div>
            </div>

            {stop.neighborhood && (
              <div style={{ fontSize: '13px' }}>
                <div style={{ color: 'var(--text-tertiary)', fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', marginBottom: '2px' }}>Neighborhood</div>
                <div style={{ color: 'var(--text-primary)', fontWeight: '500' }}>{stop.neighborhood}</div>
              </div>
            )}

            {stop.isSchoolStop && (
              <div style={{ 
                fontSize: '10px', 
                color: 'var(--text-tertiary)', 
                display: 'flex', 
                alignItems: 'center', 
                gap: '4px',
                fontWeight: '700',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                marginTop: '4px'
              }}>
                <i className="fas fa-school" style={{ fontSize: '9px' }}></i>
                <span>School Zone</span>
              </div>
            )}
          </div>
        </div>

        {/* Action Row */}
        <div style={{ display: 'flex', gap: '10px', marginTop: '1.5rem' }}>
          <button
            onClick={(e) => handleMapLinkClick(e, stop.address, stop.coordinates)}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              padding: '10px',
              borderRadius: '9999px',
              backgroundColor: 'var(--bg-tertiary)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-primary)',
              fontSize: '13px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-secondary)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)'}
          >
            <i className="fas fa-directions" style={{ opacity: 0.7 }}></i>
            Directions
          </button>
          <button
            onClick={handleCopy}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              padding: '10px',
              borderRadius: '9999px',
              backgroundColor: copied ? '#4CAF50' : 'var(--bg-tertiary)',
              border: '1px solid var(--border-color)',
              color: copied ? 'white' : 'var(--text-primary)',
              fontSize: '13px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => !copied && (e.currentTarget.style.backgroundColor = 'var(--bg-secondary)')}
            onMouseLeave={(e) => !copied && (e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)')}
          >
            <i className={`fas ${copied ? 'fa-check' : 'fa-copy'}`} style={{ opacity: 0.7 }}></i>
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      </div>

      {/* Admin Section */}
      {(enableStreetPins || (editingMode && undoHistoryCount > 0)) && (
        <div style={{ 
          padding: '16px', 
          backgroundColor: 'rgba(78, 205, 196, 0.05)', 
          borderTop: '1px solid var(--border-color)',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px'
        }}>
          <div style={{ 
            fontSize: '11px', 
            fontWeight: '700', 
            color: '#4ECDC4', 
            textTransform: 'uppercase', 
            letterSpacing: '0.08em',
            marginBottom: '4px'
          }}>
            Admin Tools
          </div>
          
          {enableStreetPins && !stop.isSchoolStop && streets.length > 0 && (
            <button
              onClick={onDropStreetPins}
              disabled={loadingStreetPins}
              style={{
                width: '100%',
                background: loadingStreetPins ? 'var(--bg-tertiary)' : '#4ECDC4',
                border: 'none',
                fontSize: '13px',
                cursor: loadingStreetPins ? 'not-allowed' : 'pointer',
                color: 'white',
                padding: '10px',
                borderRadius: '9999px',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                opacity: loadingStreetPins ? 0.6 : 1,
                transition: 'all 0.2s ease',
              }}
            >
              <i className={`fas ${loadingStreetPins ? 'fa-circle-notch fa-spin' : 'fa-map-marker-alt'}`}></i>
              <span>{loadingStreetPins ? 'Dropping pins...' : 'Drop Pins on Streets'}</span>
            </button>
          )}

          {editingMode && undoHistoryCount > 0 && (
            <button
              onClick={onUndo}
              style={{
                width: '100%',
                background: 'var(--bg-primary)',
                border: `1px solid var(--border-color)`,
                fontSize: '13px',
                cursor: 'pointer',
                color: 'var(--text-primary)',
                padding: '10px',
                borderRadius: '9999px',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
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
