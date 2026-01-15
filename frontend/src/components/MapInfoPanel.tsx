import React, { useEffect, useRef } from 'react';
import { useIsMobile } from '../hooks/useMediaQuery';

interface MapInfoPanelProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  isFindMyStopVisible?: boolean;
}

export const MapInfoPanel: React.FC<MapInfoPanelProps> = ({ isOpen, onClose, children, isFindMyStopVisible = false }) => {
  const isMobile = useIsMobile();

  // Refs for direct DOM manipulation to ensure 60fps
  const panelRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // Gesture tracking refs
  const dragInfo = useRef({
    startY: 0,
    currentY: 0,
    isDragging: false,
    startTime: 0,
    lastY: 0,
    lastTime: 0,
    velocity: 0,
    isAtTopAtStart: false
  });

  useEffect(() => {
    if (!isMobile || !isOpen) return;

    const panel = panelRef.current;
    if (!panel) return;

    const handleTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0];
      dragInfo.current.startY = touch.clientY;
      dragInfo.current.lastY = touch.clientY;
      dragInfo.current.startTime = Date.now();
      dragInfo.current.lastTime = dragInfo.current.startTime;
      dragInfo.current.velocity = 0;
      dragInfo.current.isDragging = true;

      // Check if we're at the top of the scrollable content when starting the gesture
      const content = contentRef.current;
      dragInfo.current.isAtTopAtStart = content ? content.scrollTop <= 0 : true;

      // Disable transition during drag
      panel.style.transition = 'none';
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!dragInfo.current.isDragging) return;

      const touch = e.touches[0];
      const deltaY = touch.clientY - dragInfo.current.startY;
      const now = Date.now();
      const dt = now - dragInfo.current.lastTime;

      if (dt > 0) {
        dragInfo.current.velocity = (touch.clientY - dragInfo.current.lastY) / dt;
      }

      dragInfo.current.lastY = touch.clientY;
      dragInfo.current.lastTime = now;

      // Only drag down, and only if we started at the top of the content
      if (deltaY > 0 && dragInfo.current.isAtTopAtStart) {
        // Prevent default only when we are actually dragging the panel down
        // to avoid conflicts with pull-to-refresh or other browser gestures
        if (e.cancelable) e.preventDefault();

        panel.style.transform = `translateY(${deltaY}px)`;
      } else if (deltaY < 0 && dragInfo.current.isAtTopAtStart) {
        // If they try to swipe up while at top, don't move the panel
        panel.style.transform = `translateY(0px)`;
      }
    };

    const handleTouchEnd = () => {
      if (!dragInfo.current.isDragging) return;
      dragInfo.current.isDragging = false;

      const deltaY = dragInfo.current.lastY - dragInfo.current.startY;
      const v = dragInfo.current.velocity;

      // Re-enable transition for snapping
      panel.style.transition = 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)';

      // Logic: Close if swiped down > 120px OR if flicked down fast enough
      const shouldClose = (deltaY > 120 && dragInfo.current.isAtTopAtStart) ||
        (v > 0.5 && deltaY > 20 && dragInfo.current.isAtTopAtStart);

      if (shouldClose) {
        panel.style.transform = 'translateY(100%)';
        // Small delay to allow animation to complete before calling onClose
        setTimeout(onClose, 300);
      } else {
        // Snap back
        panel.style.transform = 'translateY(0px)';
      }
    };

    panel.addEventListener('touchstart', handleTouchStart, { passive: false });
    panel.addEventListener('touchmove', handleTouchMove, { passive: false });
    panel.addEventListener('touchend', handleTouchEnd);

    return () => {
      panel.removeEventListener('touchstart', handleTouchStart);
      panel.removeEventListener('touchmove', handleTouchMove);
      panel.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isMobile, isOpen, onClose]);

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
    bottom: (isMobile && isFindMyStopVisible) ? '60px' : 0,
    left: 0,
    right: 0,
    zIndex: 900, // Lowered to be below header/menu (1000+)
    backgroundColor: 'var(--bg-secondary)',
    borderTopLeftRadius: '20px',
    borderTopRightRadius: '20px',
    boxShadow: '0 -4px 16px rgba(0, 0, 0, 0.15)',
    padding: '8px 0 0 0',
    pointerEvents: 'auto',
    transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    animation: 'slideUpMobile 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    willChange: 'transform',
    touchAction: 'none',
  };

  return (
    <>
      {/* Mobile Backdrop - Transparent and non-interactive to allow map interaction */}
      {isMobile && isOpen && (
        <div
          ref={backdropRef}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'transparent', // No graying out
            zIndex: 899,
            pointerEvents: 'none', // Allow interacting with the map
          }}
        />
      )}

      <div
        ref={panelRef}
        style={isMobile ? mobileStyle : desktopStyle}
      >
        {isMobile && (
          <div style={{
            width: '100%',
            height: '24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'grab'
          }}>
            <div style={{
              width: '40px',
              height: '4px',
              backgroundColor: 'var(--text-tertiary)',
              opacity: 0.3,
              borderRadius: '2px',
            }} />
          </div>
        )}
        <div
          ref={contentRef}
          style={isMobile ? {
            maxHeight: '80vh',
            overflowY: 'auto',
            backgroundColor: 'var(--bg-primary)',
            paddingBottom: '24px',
            WebkitOverflowScrolling: 'touch',
            overscrollBehaviorY: 'contain' // Prevent rubber-banding conflicts
          } : undefined}
        >
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
      `}</style>
    </>
  );
};
