import React from 'react';
import { HomeAddress } from '../types';
import { useIsMobile } from '../hooks/useMediaQuery';
import { useStore } from '../store/useStore';
import { MapPinIcon } from './MapPinIcon';
import { XIcon } from './XIcon';

interface HomeInfoTooltipProps {
  address: HomeAddress;
  onClose?: () => void;
  onClear?: () => void;
}

export const HomeInfoTooltip: React.FC<HomeInfoTooltipProps> = ({ 
  address, 
  onClose,
  onClear
}) => {
  const isMobile = useIsMobile();
  const isDarkMode = useStore(state => state.isDarkMode);

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
      {/* Header */}
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
            Home Location
          </h3>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '0.375rem',
            color: 'var(--brand-primary)',
            fontSize: '12px',
            fontWeight: '500',
            marginTop: '0.2rem',
            marginBottom: isMobile ? '14px' : '0'
          }}>
            <i className="fas fa-house" style={{ fontSize: '10px', width: '10px', flexShrink: 0 }}></i>
            <span>Your Address</span>
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
        <div style={{ display: 'grid', gap: '1rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {address.neighborhood && (
              <div style={{ fontSize: isMobile ? '16px' : '13px' }}>
                <div style={{ color: 'var(--text-tertiary)', fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', marginBottom: '5px' }}>Neighborhood</div>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                  <i className="fas fa-city" style={{ fontSize: isMobile ? '11px' : '9px', color: 'var(--text-tertiary)', flexShrink: 0, marginTop: isMobile ? '5px' : '4px' }}></i>
                  <div style={{ color: 'var(--text-primary)', fontWeight: '500' }}>{address.neighborhood}</div>
                </div>
              </div>
            )}

            <div style={{ fontSize: isMobile ? '16px' : '13px' }}>
              <div style={{ color: 'var(--text-tertiary)', fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', marginBottom: '5px' }}>Address</div>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                <MapPinIcon width={isMobile ? 11 : 9} height={isMobile ? 15 : 13} style={{ flexShrink: 0, color: 'var(--text-tertiary)', marginTop: isMobile ? '4px' : '2px' }} />
                <div style={{ color: 'var(--text-primary)', fontWeight: '500' }}>{address.address}</div>
              </div>
            </div>
          </div>
        </div>

        {onClear && (
          <button
            onClick={(e) => { e.stopPropagation(); onClear(); }}
            style={{ 
              display: 'flex', 
              gap: '0.75rem', 
              padding: '10px 16px',
              backgroundColor: isDarkMode ? 'var(--bg-tertiary)' : 'var(--bg-secondary)',
              borderRadius: '9999px',
              border: '1px solid var(--border-color)',
              textAlign: 'center',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              width: '100%',
              alignItems: 'center',
              justifyContent: 'center',
              marginTop: '1.5rem',
              color: 'var(--text-primary)',
              fontSize: '13px',
              fontWeight: '600'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = isDarkMode ? 'var(--bg-secondary)' : 'var(--bg-tertiary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = isDarkMode ? 'var(--bg-tertiary)' : 'var(--bg-secondary)';
            }}
          >
            <i className="fas fa-trash-alt" style={{ fontSize: '12px' }}></i>
            <span>Clear Home Location</span>
          </button>
        )}
      </div>
    </div>
  );
};


