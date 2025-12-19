interface TabBarProps {
  activeTab: 'schools' | 'routes' | 'neighborhoods';
  onTabChange: (tab: 'schools' | 'routes' | 'neighborhoods') => void;
}

export function TabBar({ activeTab, onTabChange }: TabBarProps) {
  const isSchoolsActive = activeTab === 'schools';
  const isRoutesActive = activeTab === 'routes' || activeTab === 'neighborhoods';

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        padding: '0.75rem 1rem',
        paddingTop: 'calc(0.75rem + 4px)',
        paddingBottom: 'calc(0.75rem + 6px)',
        backgroundColor: 'var(--bg-secondary)',
        borderRadius: '6px',
        borderBottom: '1px solid var(--border-color)',
        overflow: 'hidden',
      }}
    >
      {/* Labels positioned on top */}
      <div style={{
        position: 'relative',
        display: 'flex',
        height: '2.5rem',
        zIndex: 2,
      }}>
        <div
          onClick={() => onTabChange('schools')}
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem',
            fontSize: '14px',
            fontWeight: '500',
            color: isSchoolsActive ? 'var(--text-primary)' : 'var(--text-secondary)',
            transition: 'color 0.2s ease',
            cursor: 'pointer',
            minHeight: '44px', // Better touch target for mobile
            WebkitTapHighlightColor: 'transparent', // Remove tap highlight on mobile
          }}
        >
          <i className="fas fa-graduation-cap" style={{ fontSize: '12px' }}></i>
          Schools
        </div>
        <div
          onClick={() => onTabChange(activeTab === 'neighborhoods' ? 'neighborhoods' : 'routes')}
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem',
            fontSize: '14px',
            fontWeight: '500',
            color: isRoutesActive ? 'var(--text-primary)' : 'var(--text-secondary)',
            transition: 'color 0.2s ease',
            cursor: 'pointer',
            minHeight: '44px', // Better touch target for mobile
            lineHeight: '1',
            WebkitTapHighlightColor: 'transparent', // Remove tap highlight on mobile
          }}
        >
          {activeTab === 'neighborhoods' ? (
            <>
              <i className="fas fa-map-marker-alt" style={{ fontSize: '14px' }}></i>
              Neighborhoods
            </>
          ) : (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 12h18M3 6h18M3 18h18"></path>
                <circle cx="6" cy="12" r="2"></circle>
                <circle cx="18" cy="12" r="2"></circle>
              </svg>
              Routes
            </>
          )}
        </div>
      </div>
      {/* Sliding button beneath labels - uses theme colors */}
      <div
        style={{
          position: 'absolute',
          top: '17px',
          height: '41px',
          left: isSchoolsActive ? '1rem' : 'calc(50%)',
          width: 'calc(50% - 1rem)',
          backgroundColor: 'var(--bg-tertiary)',
          borderRadius: '4px',
          transition: 'left 0.3s ease',
          zIndex: 1,
          boxShadow: '0 1px 3px var(--shadow-large)',
        }}
      />
    </div>
  );
}

