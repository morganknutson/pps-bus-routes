import React from 'react';
import { useIsMobile } from '../hooks/useMediaQuery';

interface MapInfoPanelProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

export const MapInfoPanel: React.FC<MapInfoPanelProps> = ({ isOpen, onClose, children }) => {
  const isMobile = useIsMobile();

  if (!isOpen) return null;

  const desktopStyle: React.CSSProperties = {
    position: 'absolute',
    bottom: '24px',
    right: '24px',
    zIndex: 1000,
    pointerEvents: 'auto',
    animation: 'slideInRight 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
  };

  const mobileStyle: React.CSSProperties = {
    position: 'fixed',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 2000,
    backgroundColor: 'var(--bg-secondary)',
    borderTopLeftRadius: '20px',
    borderTopRightRadius: '20px',
    boxShadow: '0 -4px 16px rgba(0, 0, 0, 0.15)',
    padding: '8px 0 0 0',
    pointerEvents: 'auto',
    animation: 'slideUpMobile 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
  };

  return (
    <>
      {/* Mobile Backdrop (Non-closing, allows map interaction) */}
      {isMobile && isOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'transparent',
            zIndex: 1999,
            pointerEvents: 'none',
          }}
        />
      )}

      <div style={isMobile ? mobileStyle : desktopStyle}>
        {isMobile && (
          <div style={{
            width: '40px',
            height: '4px',
            backgroundColor: 'var(--text-tertiary)',
            opacity: 0.3,
            borderRadius: '2px',
            margin: '0 auto 12px auto',
          }} />
        )}
        <div style={isMobile ? { maxHeight: '80vh', overflowY: 'auto', backgroundColor: 'var(--bg-primary)', paddingBottom: '24px' } : undefined}>
          {children}
        </div>
      </div>

      <style>{`
        @keyframes slideInRight {
          from {
            transform: translateX(20px);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        @keyframes slideUpMobile {
          from {
            transform: translateY(100%);
          }
          to {
            transform: translateY(0);
          }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </>
  );
};

