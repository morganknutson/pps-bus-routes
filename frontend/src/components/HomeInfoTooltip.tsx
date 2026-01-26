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

import { Button } from './Button';

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
      borderRadius: isMobile ? '0' : 'var(--radius-floating)',
      overflow: 'hidden',
      boxShadow: isMobile ? 'none' : 'var(--drop-shadow-floating-primary)',
      border: isMobile ? 'none' : 'none',
      pointerEvents: 'auto',
      fontFamily: "'Inter', sans-serif",

    }}>
      {/* Header */}
      <div style={{
        padding: isMobile ? '8px 2rem 12px 2rem' : 'var(--floating-header-padding)',
        backgroundColor: 'var(--bg-secondary)',
        borderBottom: 'none',
        position: 'relative',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: '1rem',
      }}>
        <div style={{ flex: 1 }}>
          <h3 style={{
            margin: '0 0 0.75rem 0',
            fontSize: isMobile ? '26px' : '18px',
            fontWeight: '600',
            lineHeight: '22px',
            color: 'var(--text-primary)',
            letterSpacing: '-0.025em',
          }}>
            Home Location
          </h3>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.375rem',
            color: 'var(--text-tertiary)',
            fontSize: '12px',
            fontWeight: '500',
            marginTop: '0.2rem',
            marginBottom: isMobile ? '14px' : '0',
          }}>
            <i className="fas fa-house" style={{ fontSize: '10px', width: '10px', flexShrink: 0 }}></i>
            <span>Your Address</span>
          </div>
        </div>

        {onClose && !isMobile && (
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
              top: isMobile ? '3px' : '30px',
              right: isMobile ? '22px' : '34px',
              transition: 'color 0.2s ease',
              zIndex: 10,
              lineHeight: 1
            }}
            aria-label="Close dialog"
          >
            <XIcon />
          </button>
        )}
      </div>

      <div style={{ padding: isMobile ? '1.5rem 2rem' : 'var(--floating-content-padding)' }}>
        <div style={{ display: 'grid', gap: '1rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {address.neighborhood && (
              <div style={{ fontSize: isMobile ? '16px' : '13px' }}>
                <div className="eyebrow">Neighborhood</div>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                  <div style={{ color: 'var(--text-primary)', fontWeight: '500' }}>{address.neighborhood}</div>
                </div>
              </div>
            )}

            <div style={{ fontSize: isMobile ? '16px' : '13px' }}>
              <div className="eyebrow">Address</div>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                <div style={{ color: 'var(--text-primary)', fontWeight: '500' }}>{address.address}</div>
              </div>
            </div>
          </div>
        </div>

        {onClear && (
          <div style={{ marginTop: '1.5rem' }}>
            <Button
              variant="secondary"
              size="large"
              fullWidth
              align="center"
              onClick={(e) => { e.stopPropagation(); onClear(); }}
            >
              Clear Home Location
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

