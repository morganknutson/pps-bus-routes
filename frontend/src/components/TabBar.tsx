import { useStore } from '../store/useStore';

interface TabBarProps {
  activeTab: 'schools' | 'routes' | 'neighborhoods';
  onTabChange: (tab: 'schools' | 'routes' | 'neighborhoods') => void;
}

export function TabBar({ activeTab, onTabChange }: TabBarProps) {
  const isDarkMode = useStore((state) => state.isDarkMode);
  const isSchoolsActive = activeTab === 'schools';
  const isRoutesActive = activeTab === 'routes' || activeTab === 'neighborhoods';

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        padding: '0.75rem 1rem',
        paddingTop: 'calc(0.75rem + 4px)',
        paddingBottom: 'calc(0.5rem + 6px)',
        backgroundColor: 'var(--bg-secondary)',
        borderBottom: 'none',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: '48px',
          backgroundColor: isDarkMode ? 'var(--bg-primary)' : 'rgba(0, 0, 0, 0.05)',
          borderRadius: '9999px',
          overflow: 'hidden',
        }}
      >
        {/* Labels positioned on top */}
        <div style={{
          position: 'relative',
          display: 'flex',
          height: '100%',
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
              fontSize: '12px',
              fontWeight: '500',
              color: isSchoolsActive ? 'var(--text-primary)' : 'var(--text-secondary)',
              transition: 'color 0.2s ease',
              cursor: 'pointer',
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
              fontSize: '12px',
              fontWeight: '500',
              color: isRoutesActive ? 'var(--text-primary)' : 'var(--text-secondary)',
              transition: 'color 0.2s ease',
              cursor: 'pointer',
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
                <i className="fas fa-route" style={{ fontSize: '14px' }}></i>
                Routes
              </>
            )}
          </div>
        </div>
        {/* Sliding button beneath labels - uses theme colors */}
        <div
          style={{
            position: 'absolute',
            top: '4px',
            bottom: '4px',
            left: isSchoolsActive ? '4px' : 'calc(50% + 4px)',
            width: 'calc(50% - 8px)',
            backgroundColor: 'var(--bg-tertiary)',
            borderRadius: '9999px',
            transition: 'left 0.3s ease',
            zIndex: 1,
            boxShadow: '0 1px 3px var(--shadow-large)',
          }}
        />
      </div>
    </div>
  );
}

