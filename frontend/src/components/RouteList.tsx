import { useStore } from '../store/useStore';
import { RouteListBase, RouteListConfig } from './RouteListBase';

interface RouteListProps {
  showBothOption?: boolean;
  onClearSchool?: () => void;
}

/**
 * Route list component for the main page
 * Uses the store directly and shows route selection checkboxes
 */
export function RouteList({ showBothOption = false, onClearSchool }: RouteListProps = {}) {
  const { routes, toggleRouteSelection, isLoading, error, selectStop, selectedStop, clearSelectedStop, selectedSchoolId, schools, directionFilter, setDirectionFilter, setSelectedSchool } = useStore();

  const selectedSchool = selectedSchoolId ? schools.find(s => s.id === selectedSchoolId) : null;

  const config: RouteListConfig = {
    directionFilter: directionFilter,
    showRouteSelection: true,
    onRouteSelectionChange: (routeId: string, checked: boolean) => {
      if (checked) {
        // Route is being selected - ensure it's selected in store
        if (!routes.find(r => r.id === routeId)?.isSelected) {
          toggleRouteSelection(routeId);
        }
      } else {
        // Route is being deselected
        if (routes.find(r => r.id === routeId)?.isSelected) {
          toggleRouteSelection(routeId);
        }
      }
    },
    onStopClick: (route, stop, stopNumber) => {
      // If clicking the same stop that's already selected, deselect it
      if (selectedStop?.route.id === route.id && selectedStop?.stop.id === stop.id) {
        clearSelectedStop();
      } else {
        selectStop(route, stop, stopNumber);
      }
    },
    isRouteSelected: (route) => route.isSelected,
    isStopSelected: (route, stop) => {
      return selectedStop?.route.id === route.id && selectedStop?.stop.id === stop.id;
    },
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {selectedSchool && (
        <div style={{
          padding: '0.75rem 1rem',
          borderBottom: '1px solid var(--border-color)',
          backgroundColor: 'var(--bg-secondary)',
          flexShrink: 0,
          transition: 'background-color 0.3s ease, border-color 0.3s ease',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-secondary)' }}>
            {selectedSchool.name}
          </div>
          <button
            onClick={() => {
              setSelectedSchool(null);
              if (onClearSchool) {
                onClearSchool();
              }
            }}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '20px',
              cursor: 'pointer',
              color: 'var(--text-tertiary)',
              padding: '0 0.25rem',
              lineHeight: '1',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'var(--text-primary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'var(--text-tertiary)';
            }}
          >
            ×
          </button>
        </div>
      )}
      {/* Direction filter toggle */}
      <div style={{
        padding: '0.75rem 1rem',
        borderBottom: '1px solid var(--border-color)',
        backgroundColor: 'var(--bg-secondary)',
        flexShrink: 0,
        transition: 'background-color 0.3s ease, border-color 0.3s ease',
      }}>
        <div
          style={{
            position: 'relative',
            width: '100%',
            height: '2.5rem',
            backgroundColor: '#F0F0F0',
            borderRadius: '6px',
            overflow: 'hidden',
          }}
        >
          {/* Labels positioned on top */}
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            zIndex: 2,
          }}>
            <div
              onClick={() => setDirectionFilter('Morning')}
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '12px',
                fontWeight: '500',
                color: directionFilter === 'Morning' ? '#000000' : 'var(--text-secondary)',
                transition: 'color 0.2s ease',
                cursor: 'pointer',
              }}
            >
              Morning
            </div>
            <div
              onClick={() => setDirectionFilter('Afternoon')}
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '12px',
                fontWeight: '500',
                color: directionFilter === 'Afternoon' ? '#000000' : 'var(--text-secondary)',
                transition: 'color 0.2s ease',
                cursor: 'pointer',
              }}
            >
              Afternoon
            </div>
            {showBothOption && (
              <div
                onClick={() => setDirectionFilter('Both')}
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '12px',
                  fontWeight: '500',
                  color: directionFilter === 'Both' ? '#000000' : 'var(--text-secondary)',
                  transition: 'color 0.2s ease',
                  cursor: 'pointer',
                }}
              >
                Both
              </div>
            )}
          </div>
          {/* White sliding button beneath labels */}
          <div
            style={{
              position: 'absolute',
              top: '0.25rem',
              bottom: '0.25rem',
              left: showBothOption
                ? directionFilter === 'Morning'
                  ? '0.25rem'
                  : directionFilter === 'Afternoon'
                  ? 'calc(33.333% + 0.25rem)'
                  : 'calc(66.666% + 0.25rem)'
                : directionFilter === 'Morning'
                ? '0.25rem'
                : 'calc(50% + 0.25rem)',
              width: showBothOption ? 'calc(33.333% - 0.5rem)' : 'calc(50% - 0.5rem)',
              backgroundColor: 'white',
              borderRadius: '4px',
              transition: 'left 0.3s ease',
              zIndex: 1,
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.2)',
            }}
          />
        </div>
      </div>
      <div style={{ flex: 1, overflow: 'auto' }}>
        <RouteListBase
          routes={routes}
          config={config}
          loading={isLoading}
          error={error}
          emptyMessage="No routes found. Make sure routes.json exists in the public folder."
        />
      </div>
    </div>
  );
}
