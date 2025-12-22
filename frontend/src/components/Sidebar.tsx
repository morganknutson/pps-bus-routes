import { ReactNode, useEffect, useState, useRef, useCallback } from 'react';
import { useIsMobile } from '../hooks/useMediaQuery';

export interface SidebarProps {
  children: ReactNode;
  header?: ReactNode;
  tabs?: ReactNode;
  width?: string;
  backgroundColor?: string;
  isOpen?: boolean;
  onClose?: () => void;
  resizable?: boolean;
  minWidth?: number;
  maxWidth?: number;
  persistenceKey?: string;
}

/**
 * Standardized sidebar component
 * Ensures consistent styling across all pages
 * On mobile, shows as overlay with backdrop when isOpen is true
 */
export function Sidebar({ 
  children, 
  header,
  tabs,
  width: initialWidth = '350px',
  backgroundColor,
  isOpen,
  onClose,
  resizable = true,
  minWidth = 250,
  maxWidth = 600,
  persistenceKey = 'sidebar-width'
}: SidebarProps) {
  const isMobile = useIsMobile();
  
  // Use numeric width for resizing
  const getInitialWidth = () => {
    if (isMobile) return window.innerWidth;
    const savedWidth = localStorage.getItem(persistenceKey);
    if (savedWidth) return parseInt(savedWidth, 10);
    return parseInt(initialWidth, 10) || 350;
  };

  const [sidebarWidth, setSidebarWidth] = useState(getInitialWidth());
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);

  // Update width when isMobile changes
  useEffect(() => {
    if (isMobile) {
      setSidebarWidth(window.innerWidth);
    } else {
      const savedWidth = localStorage.getItem(persistenceKey);
      setSidebarWidth(savedWidth ? parseInt(savedWidth, 10) : parseInt(initialWidth, 10) || 350);
    }
  }, [isMobile, initialWidth, persistenceKey]);

  const startResizing = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  const stopResizing = useCallback(() => {
    setIsResizing(false);
    if (!isMobile) {
      localStorage.setItem(persistenceKey, sidebarWidth.toString());
    }
  }, [isMobile, persistenceKey, sidebarWidth]);

  const resize = useCallback((e: MouseEvent) => {
    if (isResizing) {
      const newWidth = e.clientX;
      if (newWidth >= minWidth && newWidth <= maxWidth) {
        setSidebarWidth(newWidth);
      }
    }
  }, [isResizing, minWidth, maxWidth]);

  useEffect(() => {
    if (isResizing) {
      window.addEventListener('mousemove', resize);
      window.addEventListener('mouseup', stopResizing);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    } else {
      window.removeEventListener('mousemove', resize);
      window.removeEventListener('mouseup', stopResizing);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }

    return () => {
      window.removeEventListener('mousemove', resize);
      window.removeEventListener('mouseup', stopResizing);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing, resize, stopResizing]);

  // Default to true on desktop, false on mobile
  const shouldShow = isOpen !== undefined ? isOpen : !isMobile;

  // Prevent body scroll when sidebar is open on mobile
  useEffect(() => {
    if (isMobile && shouldShow) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    }
  }, [isMobile, shouldShow]);

  // On desktop, show sidebar if isOpen is true or undefined
  if (!isMobile && shouldShow) {
    return (
      <div
        ref={sidebarRef}
        style={{
          width: `${sidebarWidth}px`,
          position: 'relative',
          borderRight: '1px solid var(--border-color)',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: backgroundColor || 'var(--bg-secondary)',
          overflow: 'hidden',
          transition: isResizing ? 'none' : 'background-color 0.3s ease, border-color 0.3s ease, width 0.1s ease',
          flexShrink: 0,
        }}
      >
        {/* Resize Handle */}
        {resizable && (
          <div
            onMouseDown={startResizing}
            style={{
              position: 'absolute',
              top: 0,
              right: -3,
              bottom: 0,
              width: '6px',
              cursor: 'col-resize',
              zIndex: 10,
              backgroundColor: isResizing ? 'var(--accent-primary, #FFFFFF)' : 'transparent',
              transition: 'background-color 0.2s ease',
            }}
            onMouseEnter={(e) => {
              if (!isResizing) e.currentTarget.style.backgroundColor = 'rgba(78, 205, 196, 0.3)';
            }}
            onMouseLeave={(e) => {
              if (!isResizing) e.currentTarget.style.backgroundColor = 'transparent';
            }}
          />
        )}
        
        {/* Fixed Header Section */}
        {header && (
          <div style={{ 
            borderBottom: '1px solid var(--border-color)', 
            padding: '1rem', 
            backgroundColor: 'var(--bg-primary)',
            flexShrink: 0,
            transition: 'background-color 0.3s ease, border-color 0.3s ease',
          }}>
            {header}
          </div>
        )}
        
        {/* Tabs */}
        {tabs}
        
        {/* Content Section */}
        <div style={{ 
          flex: 1, 
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
        }}>
          {children}
        </div>
      </div>
    );
  }

  // On mobile, show as overlay
  return (
    <>
      {/* Backdrop */}
      {shouldShow && (
        <div
          onClick={onClose}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            zIndex: 1000,
            animation: 'fadeIn 0.2s ease-out',
          }}
        />
      )}
      
      {/* Sidebar */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: shouldShow ? 0 : '-100%',
          width: '100%',
          height: 'var(--app-height)',
          borderRight: '1px solid var(--border-color)',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: backgroundColor || 'var(--bg-secondary)',
          overflow: 'hidden',
          transition: 'left 0.125s cubic-bezier(0.68, -0.15, 0.265, 1.15)',
          zIndex: 1001,
          boxShadow: shouldShow ? '2px 0 8px rgba(0, 0, 0, 0.15)' : 'none',
          paddingTop: '74px', // Add padding to account for header height
        }}
      >
        {/* Fixed Header Section */}
        {header && (
          <div style={{ 
            borderBottom: '1px solid var(--border-color)', 
            padding: '1rem', 
            backgroundColor: 'var(--bg-primary)',
            flexShrink: 0,
            transition: 'background-color 0.3s ease, border-color 0.3s ease',
          }}>
            {header}
          </div>
        )}
        
        {/* Tabs */}
        {tabs}
        
        {/* Content Section */}
        <div style={{ 
          flex: 1, 
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
        }}>
          {children}
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
      `}</style>
    </>
  );
}

