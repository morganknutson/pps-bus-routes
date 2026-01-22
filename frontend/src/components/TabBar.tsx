import { useStore } from '../store/useStore';
import { analyticsService } from '../services/analytics';
import { RouteIcon } from './RouteIcon';

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
          backgroundColor: 'var(--bg-tertiary)',
          borderRadius: 'var(--radius-pill)',
          overflow: 'hidden',
          boxShadow: 'var(--edge-outer-secondary), var(--inset-shadow-secondary)',
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
            onClick={() => {
              analyticsService.trackTabChange('schools');
              onTabChange('schools');
            }}
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
            onClick={() => {
              const tab = activeTab === 'neighborhoods' ? 'neighborhoods' : 'routes';
              analyticsService.trackTabChange(tab);
              onTabChange(tab);
            }}
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
                <i className="fas fa-map-marker-alt" style={{ fontSize: '12px' }}></i>
                Neighborhoods
              </>
            ) : (
              <>
                <RouteIcon size={12} color={isRoutesActive ? 'var(--text-primary)' : 'var(--text-secondary)'} />
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
            backgroundColor: 'var(--bg-primary)',
            borderRadius: 'var(--radius-pill)',
            transition: 'left 0.3s ease',
            zIndex: 1,
            boxShadow: 'var(--drop-shadow-tertiary), var(--edge-inner-primary)',
          }}
        />
      </div>
    </div>
  );
}

