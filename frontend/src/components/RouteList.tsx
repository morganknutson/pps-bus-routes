import { useStore } from '../store/useStore';
import { RouteListBase, RouteListConfig } from './RouteListBase';
import { useDarkMode } from '../hooks/useDarkMode';
import { analyticsService } from '../services/analytics';

interface RouteListProps {
  showBothOption?: boolean;
  onClearSchool?: () => void;
  onViewSchools?: () => void;
  onRouteToggle?: () => void;  // Called when user explicitly toggles a route (for URL sync)
}

/**
 * Route list component for the main page
 * Uses the store directly and shows route selection checkboxes
 */
export function RouteList({ showBothOption = false, onClearSchool, onViewSchools, onRouteToggle }: RouteListProps = {}) {
  const { routes, toggleRouteSelection, isLoading, error, selectStop, selectedStop, clearSelectedStop, selectedSchoolId, schools, directionFilter, setDirectionFilter, setSelectedSchool } = useStore();
  const { isDarkMode } = useDarkMode();

  const selectedSchool = selectedSchoolId ? schools.find(s => s.id === selectedSchoolId) : null;

  const config: RouteListConfig = {
    directionFilter: directionFilter,
    showRouteSelection: true,
    onRouteSelectionChange: (routeId: string, checked: boolean) => {
      // Mark that user is toggling a route (for URL sync to not override)
      onRouteToggle?.();
      
      const route = routes.find(r => r.id === routeId);
      if (route && selectedSchool) {
        analyticsService.trackRouteToggle(route.name, selectedSchool.name, checked);
      }
      
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
        // If route is not selected, select it first so it shows on the map
        let updatedRoute = route;
        if (!route.isSelected) {
          toggleRouteSelection(route.id);
          // Update the route object to reflect the new selection state
          updatedRoute = { ...route, isSelected: true };
        }
        // Then select the stop
        selectStop(updatedRoute, stop, stopNumber);
      }
    },
    isRouteSelected: (route) => route.isSelected,
    isStopSelected: (route, stop) => {
      return selectedStop?.route.id === route.id && selectedStop?.stop.id === stop.id;
    },
  };

  // Show prompt when no school is selected
  if (!selectedSchoolId) {
    return (
      <div style={{ 
        display: 'flex', 
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        padding: '2rem',
        textAlign: 'center',
        color: 'var(--text-secondary)',
        backgroundColor: 'var(--bg-primary)'
      }}>
        <i 
          className="fas fa-graduation-cap" 
          style={{ 
            fontSize: '48px',
            color: 'var(--text-tertiary)',
            marginBottom: '1rem',
            opacity: 0.6
          }}
        />
        <p style={{ 
          fontSize: '16px',
          fontWeight: '500',
          margin: 0,
          marginBottom: '1rem',
          color: 'var(--text-secondary)'
        }}>
          Please select a school to view routes
        </p>
        {onViewSchools && (
          <button
            onClick={onViewSchools}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: 'var(--bg-primary)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-color)',
              borderRadius: '9999px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500',
              transition: 'background-color 0.2s ease, border-color 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--bg-secondary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--bg-primary)';
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
                width: '100%',
                padding: '0.75rem',
                paddingLeft: '1rem',
                paddingRight: '2.5rem',
                borderRadius: '12px',
                fontSize: '12px',
                boxSizing: 'border-box',
                backgroundColor: 'var(--bg-tertiary)',
                color: 'var(--text-primary)',
                transition: 'background-color 0.3s ease, color 0.3s ease',
                boxShadow: '0 1px 3px var(--shadow-large)',
              }}
            >
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
                position: 'absolute',
                right: '10px',
                top: '50%',
                transform: 'translateY(-50%)',
                width: '20px',
                height: '20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '14px',
                lineHeight: '1',
                backgroundColor: 'transparent',
                color: 'var(--text-tertiary)',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                padding: 0,
                flexShrink: 0,
                transition: 'background-color 0.2s ease, color 0.2s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--bg-secondary)';
                e.currentTarget.style.color = 'var(--text-primary)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = 'var(--text-tertiary)';
              }}
            aria-label="Clear school selection"
          >
            <i className="fas fa-times" style={{ fontSize: '14px' }}></i>
          </button>
          </div>
        </div>
      )}
      {/* Direction filter toggle */}
      <div style={{
        padding: '0.75rem 0.75rem 0.5rem 0.75rem', // Reduced bottom padding to reduce space
        borderBottom: 'none',
        backgroundColor: 'var(--bg-route-list)',
        flexShrink: 0,
        transition: 'background-color 0.3s ease, border-color 0.3s ease',
      }}>
        <div
          style={{
            position: 'relative',
            width: '100%',
            height: '2.5rem',
            backgroundColor: isDarkMode ? 'var(--bg-primary)' : 'rgba(0, 0, 0, 0.05)',
            borderRadius: '9999px',
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
                color: directionFilter === 'Morning' ? 'var(--text-primary)' : 'var(--text-secondary)',
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
                color: directionFilter === 'Afternoon' ? 'var(--text-primary)' : 'var(--text-secondary)',
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
                  color: directionFilter === 'Both' ? 'var(--text-primary)' : 'var(--text-secondary)',
                  transition: 'color 0.2s ease',
                  cursor: 'pointer',
                }}
              >
                Both
              </div>
            )}
          </div>
          {/* Sliding button beneath labels - uses theme colors */}
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
              backgroundColor: 'var(--bg-tertiary)',
              borderRadius: '9999px',
              transition: 'left 0.3s ease',
              zIndex: 1,
              boxShadow: '0 1px 3px var(--shadow-large)',
            }}
          />
        </div>
      </div>
      <div style={{ flex: 1, overflow: 'auto', backgroundColor: 'var(--bg-route-list)' }}>
        {!isLoading && routes.length === 0 ? (
          <div style={{
            padding: '2rem',
            textAlign: 'center',
            color: 'var(--text-secondary)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '1rem'
          }}>
            <i className="fas fa-exclamation-circle" style={{ fontSize: '32px', color: '#f44', opacity: 0.8 }}></i>
            <p style={{ fontSize: '14px', fontWeight: '500', lineHeight: '1.4' }}>
              Route information not provided on the web by school district.
            </p>
          </div>
        ) : (
          <RouteListBase
            routes={routes}
            config={config}
            loading={isLoading}
            error={error}
            emptyMessage="No routes found. Make sure routes.json exists in the public folder."
          />
        )}
      </div>
    </div>
  );
}
