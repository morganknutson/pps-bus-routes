import { ReactNode } from 'react';

export interface SidebarProps {
  children: ReactNode;
  header?: ReactNode;
  tabs?: ReactNode;
  width?: string;
  backgroundColor?: string;
}

/**
 * Standardized sidebar component
 * Ensures consistent styling across all pages
 */
export function Sidebar({ 
  children, 
  header,
  tabs,
  width = '350px',
  backgroundColor
}: SidebarProps) {
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

