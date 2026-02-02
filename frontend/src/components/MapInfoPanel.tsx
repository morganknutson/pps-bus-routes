import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { useIsMobile } from '../hooks/useMediaQuery';
import { useIsStandalone } from '../hooks/useIsStandalone';

// --- Sheet Stage Context ---
type SheetStage = 'full' | 'minimized';

const SheetStageContext = createContext<{ minimized: boolean }>({ minimized: false });

export const useSheetStage = () => useContext(SheetStageContext);

export const CollapsibleBody: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { minimized } = useSheetStage();
  return (
    <div style={{
      display: 'grid',
      gridTemplateRows: minimized ? '0fr' : '1fr',
      transition: 'grid-template-rows 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    }}>
      <div style={{ overflow: 'hidden' }}>
        {children}
      </div>
    </div>
  );
};

interface MapInfoPanelProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  isFindMyStopVisible?: boolean;
  contentKey?: string;
}

export const MapInfoPanel: React.FC<MapInfoPanelProps> = ({ isOpen, onClose, children, isFindMyStopVisible = false, contentKey }) => {
  const isMobile = useIsMobile();
  const isStandalone = useIsStandalone();
  const [stage, setStage] = useState<SheetStage>('full');

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

  // Track stage in a ref so the touch handler closure always sees the latest value
  const stageRef = useRef<SheetStage>(stage);
  useEffect(() => {
    stageRef.current = stage;
  }, [stage]);

  // Reset stage to 'full' when contentKey or isOpen changes
  useEffect(() => {
    setStage('full');
  }, [contentKey, isOpen]);

  // Defer overflow change so it doesn't cause a layout shift during collapse
  useEffect(() => {
    if (!contentRef.current) return;
    if (stage === 'minimized') {
      const id = setTimeout(() => {
        if (contentRef.current) contentRef.current.style.overflowY = 'hidden';
      }, 310); // just after the 300ms collapse finishes
      return () => clearTimeout(id);
    } else {
      contentRef.current.style.overflowY = 'auto';
    }
  }, [stage]);

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
      // When minimized, treat as always at top (no scrollable content)
      dragInfo.current.isAtTopAtStart = stageRef.current === 'minimized' ? true : (content ? content.scrollTop <= 0 : true);

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
        if (e.cancelable) e.preventDefault();
        panel.style.transform = `translateY(${deltaY}px)`;
      } else if (deltaY < 0 && dragInfo.current.isAtTopAtStart) {
        // When minimized, allow upward drag with dampening for visual feedback
        if (stageRef.current === 'minimized') {
          if (e.cancelable) e.preventDefault();
          const dampened = deltaY * 0.3;
          panel.style.transform = `translateY(${dampened}px)`;
        } else {
          panel.style.transform = `translateY(0px)`;
        }
      }
    };

    const handleTouchEnd = () => {
      if (!dragInfo.current.isDragging) return;
      dragInfo.current.isDragging = false;

      const deltaY = dragInfo.current.lastY - dragInfo.current.startY;
      const v = dragInfo.current.velocity;
      const currentStage = stageRef.current;

      // Re-enable transition for snapping
      panel.style.transition = 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)';

      if (currentStage === 'full') {
        // Full → Minimized: swipe down past 80px or velocity > 0.5
        const shouldMinimize = (deltaY > 80 && dragInfo.current.isAtTopAtStart) ||
          (v > 0.5 && deltaY > 20 && dragInfo.current.isAtTopAtStart);

        if (shouldMinimize) {
          // Keep the panel at its current drag offset while the body collapses.
          // The panel is bottom-anchored, so as its height shrinks the top edge
          // moves down naturally — no upward jump. After the collapse finishes,
          // smoothly settle the transform back to 0.
          panel.style.transition = 'none';
          setStage('minimized');
          setTimeout(() => {
            panel.style.transition = 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
            panel.style.transform = 'translateY(0px)';
          }, 300);
        } else {
          panel.style.transform = 'translateY(0px)';
        }
      } else if (currentStage === 'minimized') {
        // Minimized → Full: swipe up past 60px or velocity < -0.5
        const shouldExpand = (deltaY < -60 && dragInfo.current.isAtTopAtStart) ||
          (v < -0.5 && deltaY < -20);

        // Minimized → Closed: swipe down past 80px or velocity > 0.5
        const shouldClose = (deltaY > 80 && dragInfo.current.isAtTopAtStart) ||
          (v > 0.5 && deltaY > 20 && dragInfo.current.isAtTopAtStart);

        if (shouldExpand) {
          setStage('full');
          panel.style.transform = 'translateY(0px)';
        } else if (shouldClose) {
          panel.style.transform = 'translateY(100%)';
          setTimeout(onClose, 300);
        } else {
          panel.style.transform = 'translateY(0px)';
        }
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
    bottom: 0,
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
            height: '44px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'grab',
            backgroundColor: 'var(--bg-primary)',
            marginTop: '-8px',
            paddingBottom: '18px',
            borderRadius: '20px 20px 0 0',
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
            backgroundColor: 'var(--bg-secondary)',
            paddingBottom: isFindMyStopVisible
              ? (isStandalone ? 'calc(env(safe-area-inset-bottom, 20px) + 114px)' : '104px')
              : 'calc(24px + env(safe-area-inset-bottom))',
            WebkitOverflowScrolling: 'touch',
            overscrollBehaviorY: 'contain' // Prevent rubber-banding conflicts
          } : undefined}
        >
          <SheetStageContext.Provider value={{ minimized: stage === 'minimized' }}>
            {children}
          </SheetStageContext.Provider>
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
