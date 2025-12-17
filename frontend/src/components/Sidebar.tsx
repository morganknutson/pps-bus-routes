import { ReactNode, useEffect } from 'react';
import { useIsMobile } from '../hooks/useMediaQuery';

export interface SidebarProps {
  children: ReactNode;
  header?: ReactNode;
  tabs?: ReactNode;
  width?: string;
  backgroundColor?: string;
  isOpen?: boolean;
  onClose?: () => void;
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
  width = '350px',
  backgroundColor,
  isOpen,
  onClose
}: SidebarProps) {
  const isMobile = useIsMobile();
  
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
        style={{
          width,
          borderRight: '1px solid var(--border-color)',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: backgroundColor || 'var(--bg-secondary)',
          overflow: 'hidden',
          transition: 'background-color 0.3s ease, border-color 0.3s ease',
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
        
        {/* Scrollable Content Section */}
        <div style={{ 
          flex: 1, 
          overflow: 'auto',
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
          height: '100vh',
          borderRight: '1px solid var(--border-color)',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: backgroundColor || 'var(--bg-secondary)',
          overflow: 'hidden',
          transition: 'left 0.3s ease-out',
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
        
        {/* Scrollable Content Section */}
        <div style={{ 
          flex: 1, 
          overflow: 'auto',
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

