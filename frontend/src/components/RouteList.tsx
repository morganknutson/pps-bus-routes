import { useNavigate, useLocation } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { RouteListBase, RouteListConfig } from './RouteListBase';
import { DirectionToggle } from './DirectionToggle';
import { analyticsService } from '../services/analytics';
import { XIcon } from './XIcon';
import { useUrlState } from '../hooks/useUrlState';

interface RouteListProps {
  showBothOption?: boolean;
  onClearSchool?: () => void;
  onViewSchools?: () => void;
  onRouteToggle?: () => void;
}

/**
 * Route list component for the main page
 * Uses the URL as source of truth for selection
 */
export function RouteList({ showBothOption = false, onClearSchool, onViewSchools, onRouteToggle }: RouteListProps = {}) {
  const navigate = useNavigate();
  const location = useLocation();
  const { routes, isLoading, error, schools } = useStore();

  const basePath = location.pathname.startsWith('/admin') ? '/admin' : '';
  const {
    schoolId,
    directionFilter,
    selectedRouteNames,
    selectedStopId,
    setSelectedSchool,
    setDirectionFilter,
    toggleRouteSelection,
    selectStop,
    clearSelectedStop,
  } = useUrlState({ basePath });

  const selectedSchool = schoolId ? schools.find(s => s.id === schoolId) : null;

  const config: RouteListConfig = {
    directionFilter: directionFilter,
    showRouteSelection: true,
    onRouteSelectionChange: (routeId: string, checked: boolean) => {
      onRouteToggle?.();
      const route = routes.find(r => r.id === routeId);
      if (route) {
        if (selectedSchool) {
          analyticsService.trackRouteToggle(route.name, selectedSchool.name, checked);
        }
        toggleRouteSelection(route.name);
      }
    },
    onStopClick: (route, stop, stopNumber) => {
      if (selectedStopId === `${route.name}-${stop.id.replace('stop-', '')}`) {
        clearSelectedStop();
      } else {
        selectStop(route.name, stop.id);
      }
    },
    isRouteSelected: (route) => {
      // Scenario 1: if no route names in URL, all routes for the current direction are implicitly selected
      if (selectedRouteNames.length === 0) {
        return directionFilter === 'Both' || route.direction === directionFilter;
      }
      return selectedRouteNames.includes(route.name);
    },
    isStopSelected: (route, stop) => {
      const formattedStopId = route.name.endsWith('-upcoming')
        ? `${route.name.replace('-upcoming', '')}-${stop.id.replace('stop-', '')}-upcoming`
        : `${route.name}-${stop.id.replace('stop-', '')}`;
      return selectedStopId === formattedStopId;
    },
  };

  if (!schoolId) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        height: '100%', padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)',
        backgroundColor: 'var(--bg-primary)'
      }}>
        <i className="fas fa-graduation-cap" style={{ fontSize: '48px', color: 'var(--text-tertiary)', marginBottom: '1rem', opacity: 0.6 }} />
        <p style={{ fontSize: '16px', fontWeight: '500', margin: 0, marginBottom: '1rem', color: 'var(--text-secondary)' }}>
          Please select a school to view routes
        </p>
        {onViewSchools && (
          <button
            onClick={onViewSchools}
            style={{
              padding: '0.5rem 1rem', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)',
              border: '1px solid var(--border-color)', borderRadius: '9999px', cursor: 'pointer',
              fontSize: '14px', fontWeight: '500', transition: 'background-color 0.2s ease, border-color 0.2s ease',
            }}
          >
            View Schools
          </button>
        )}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: 'var(--bg-secondary)' }}>
      {selectedSchool && (
        <div style={{ padding: '0.5rem 1rem 1rem 1rem', borderBottom: '1px solid var(--border-color)', flexShrink: 0, transition: 'border-color 0.3s ease' }}>
          <div style={{ position: 'relative' }}>
            <div
              style={{
                width: '100%', padding: '0.75rem', paddingLeft: '1rem', paddingRight: '2.5rem',
                borderRadius: '12px', fontSize: '14px', fontWeight: '600', height: '40px',
                boxSizing: 'border-box', backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-primary)',
                transition: 'background-color 0.3s ease, color 0.3s ease', boxShadow: '0 1px 3px var(--shadow-large)',
                display: 'flex', alignItems: 'center',
              }}
            >
              {selectedSchool.name}
            </div>
            <button
              onClick={() => {
                setSelectedSchool(null);
                if (onClearSchool) onClearSchool();
              }}
              style={{
                position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)',
                width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                backgroundColor: 'transparent', color: 'var(--text-tertiary)', border: 'none',
                borderRadius: '4px', cursor: 'pointer', padding: 0, flexShrink: 0,
              }}
              aria-label="Clear school selection"
            >
              <XIcon />
            </button>
          </div>
        </div>
      )}

      <div style={{ padding: '0.75rem 0.75rem 0.5rem 0.75rem', backgroundColor: 'var(--bg-route-list)', flexShrink: 0 }}>
        <DirectionToggle
          directionFilter={directionFilter}
          onDirectionChange={setDirectionFilter}
          showBothOption={showBothOption}
        />
      </div>

      <div style={{ flex: 1, overflow: 'auto', backgroundColor: 'var(--bg-route-list)' }}>
        {!isLoading && routes.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '1rem' }}>
            <div style={{ backgroundColor: 'rgba(244, 67, 54, 0.1)', color: '#f44', fontSize: '14px', padding: '8px 20px', borderRadius: '999px', fontWeight: '700', textTransform: 'uppercase', border: '1px solid rgba(244, 67, 54, 0.3)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <i className="fas fa-exclamation-triangle" style={{ fontSize: '14px' }}></i>
              NO ROUTES
            </div>
            <p style={{ fontSize: '13px', color: 'var(--text-tertiary)', maxWidth: '200px', lineHeight: '1.4' }}>
              Route information not provided on the web by school district.
            </p>
          </div>
        ) : (
          <RouteListBase
            routes={routes}
            config={config}
            loading={isLoading}
            error={error}
            emptyMessage="No routes found."
          />
        )}
      </div>
    </div>
  );
}
