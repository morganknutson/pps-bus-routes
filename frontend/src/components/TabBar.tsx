import { useNavigate, useLocation } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { analyticsService } from '../services/analytics';
import { RouteIcon } from './RouteIcon';
import { parseUrlPath, buildUrlPath } from '../services/urlState';

interface TabBarProps {
  activeTab: 'schools' | 'routes' | 'neighborhoods';
  onTabChange?: (tab: 'schools' | 'routes' | 'neighborhoods') => void;
}

export function TabBar({ activeTab, onTabChange }: TabBarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const isDarkMode = useStore((state) => state.isDarkMode);
  
  const handleTabClick = (tab: 'schools' | 'routes' | 'neighborhoods') => {
    analyticsService.trackTabChange(tab);
    
    const urlState = parseUrlPath(location.pathname, '');
    const newState: any = {
      ...urlState,
      show: tab,
    };

    // If switching to schools tab, clear all route-specific state
    if (tab === 'schools') {
      newState.direction = undefined;
      newState.routeNames = undefined;
      newState.stopId = undefined;
      // Clear pin focus unless it's the school-info dialog
      if (urlState.focus !== 'school-info') {
        newState.focus = undefined;
      }
    } else if (tab === 'routes') {
      // If switching to routes, we can keep the school, but clear specific pin focus (home/my-stop)
      // to avoid overlapping dialogs or weird zooms
      if (urlState.focus === 'home' || urlState.focus === 'my-stop') {
        newState.focus = undefined;
      }
    }
    
    navigate(buildUrlPath('', newState));
    if (onTabChange) onTabChange(tab);
  };

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
            onClick={() => handleTabClick('schools')}
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
              handleTabClick(tab);
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

