import { useState, ReactNode } from 'react';
import { formatStreetName } from '../utils/formatAddress';
import { getSchoolTypes } from '../utils/schoolUtils';
import { formatEffectiveDate } from '../utils/dateUtils';
import { RouteIcon } from './RouteIcon';
import { ChevronIcon } from './ChevronIcon';
import { calculateStopNumber, getDisplayStops } from '../utils/routeUtils';
import type { Route, Stop } from '../types';

/**
 * Configuration for route list display options
 */
export interface RouteListConfig {
  /** Show route selection checkboxes */
  showRouteSelection?: boolean;
  /** Handler for route selection checkbox changes */
  onRouteSelectionChange?: (routeId: string, checked: boolean) => void;
  /** Show detailed geocoding stats (geocoded/failed counts) */
  showGeocodingStats?: boolean;
  /** Show filename for each route */
  showFilename?: boolean;
  /** Custom route header renderer */
  renderRouteHeader?: (route: Route) => ReactNode;
  /** Custom stop click handler */
  onStopClick?: (route: Route, stop: Stop, stopNumber: number) => void;
  /** Get route color (defaults to route.color) */
  getRouteColor?: (route: Route) => string;
  /** Check if a route is selected/highlighted */
  isRouteSelected?: (route: Route) => boolean;
  /** Check if a stop is selected */
  isStopSelected?: (route: Route, stop: Stop) => boolean;
  /** Show error indicators for stops */
  showStopErrors?: boolean;
  /** Filter routes by direction */
  directionFilter?: 'Morning' | 'Afternoon' | 'Both';
}

/**
 * Base component for displaying routes in a list
 * Uses composition and configuration to support different use cases
 */
export interface RouteListBaseProps {
  routes: Route[];
  config?: RouteListConfig;
  loading?: boolean;
  error?: string;
  emptyMessage?: string;
}

function renderStopItem(
  stop: Stop,
  route: Route,
  stopIndex: number,
  allStops: Stop[],
  config: RouteListConfig
) {
  // --- STATE: Stop Selection & Error Handling ---
  const stopNumber = calculateStopNumber(route, stop.id);
  const hasCoordinates = stop.coordinates && stop.coordinates.length === 2;
  /**
   * isClickable State: Determines if a stop can be interacted with.
   * Based on whether the stop has valid coordinates.
   * Impact: Cursor style, hover effects, and text color.
   */
  const isClickable = hasCoordinates;
  /**
   * hasError State: Indicates if a stop failed geocoding.
   * Impact: Background colors (#ffe6e6), border color (#ff6b6b), and text colors.
   */
  const hasError = config.showStopErrors && (!hasCoordinates || stop.geocodeError);
  /**
   * isSelected State (Stop): True if the current stop is the one being viewed on the map.
   * Impact: var(--bg-primary) background, 3px solid side border with route color.
   */
  const isSelected = config.isStopSelected?.(route, stop) || false;
  const routeColor = config.getRouteColor?.(route) || route.color;

  return (
    <div
      key={stop.id}
      className={`stop-item ${isClickable ? 'clickable' : ''} ${isSelected ? 'selected' : ''} ${hasError ? 'has-error' : ''}`}
      onClick={() => {
        if (isClickable && config.onStopClick) {
          config.onStopClick(route, stop, stopNumber);
        }
      }}
      style={{
        borderBottom: stopIndex < allStops.length - 1
          ? `1px solid var(${config.isRouteSelected?.(route) ? '--border-color-divider-selected' : '--border-color-divider-unselected'})`
          : 'none',
        // --- STYLES: Selection Border Color ---
        '--route-color': routeColor,
      } as React.CSSProperties}
    >
      {/* Stop icon/number */}
      {stop.isSchoolStop ? (
        <div className="stop-icon-school-container">
          {/* School icon */}
          <div className="stop-icon-school">
            <i className="fas fa-graduation-cap" style={{ fontSize: '12px' }}></i>
          </div>
          {/* Time below icon */}
          {stop.time && (
            <div className="stop-icon-school-time">
              {stop.time}
            </div>
          )}
        </div>
      ) : (
        <div className="stop-icon-regular" style={{ backgroundColor: hasError ? '#ff6b6b' : routeColor }}>
          {stopNumber}
        </div>
      )}

      {/* Stop details */}
      <div className="stop-details">
        <div className="stop-name" style={{ color: hasError ? '#ff6b6b' : (isClickable ? 'var(--text-secondary)' : 'var(--text-tertiary)') }}>
          {stop.isSchoolStop && stop.schoolName
            ? (() => {
              const schoolTypes = getSchoolTypes(stop.schoolName);
              let typeLabel = '';
              if (schoolTypes.length > 0) {
                const type = schoolTypes[0];
                if (type === 'High School') {
                  typeLabel = 'High School';
                } else {
                  typeLabel = type.replace(' School', '');
                }
              }
              return `${stop.schoolName}${typeLabel ? ` ${typeLabel}` : ''}`;
            })()
            : formatStreetName(stop.address)}
        </div>
        {stop.time && !stop.isSchoolStop && (
          <div className="stop-time-neighborhood">
            {stop.time}
            {stop.neighborhood && (
              <span className="eyebrow">
                • {stop.neighborhood}
              </span>
            )}
          </div>
        )}
        {!stop.time && stop.neighborhood && !stop.isSchoolStop && (
          <div className="eyebrow stop-neighborhood-only">
            {stop.neighborhood}
          </div>
        )}
        {config.showStopErrors && hasError && (
          <div className="stop-error-message">
            ✗ {stop.geocodeError || 'No coordinates'}
          </div>
        )}
        {config.showStopErrors && !hasError && !stop.isSchoolStop && (
          <div className="stop-geocoded-message">
            ✓ Geocoded
          </div>
        )}
        {!hasCoordinates && !stop.isSchoolStop && !config.showStopErrors && (
          <div className="stop-no-coordinates-message">
            No coordinates
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Base route list component - reusable and configurable
 */
export function RouteListBase({
  routes,
  config = {},
  loading = false,
  error,
  emptyMessage = 'No routes found'
}: RouteListBaseProps) {
  // --- STATE: UI Interaction ---
  const [expandedRoutes, setExpandedRoutes] = useState<Set<string>>(new Set());
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['Morning', 'Afternoon', 'Other']));

  if (loading && routes.length === 0) {
    return (
      <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-tertiary)' }}>
        <div style={{ marginBottom: '0.5rem' }}>
          <div
            style={{
              width: '24px',
              height: '24px',
              border: '3px solid var(--border-color)',
              borderTopColor: 'var(--text-primary)',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              margin: '0 auto',
            }}
          />
        </div>
        <p>Loading routes...</p>
      </div>
    );
  }

  if (routes.length === 0) {
    return (
      <div style={{ padding: '1rem', color: 'var(--text-tertiary)' }}>
        {error && (
          <div style={{ color: '#ff6b6b', marginBottom: '1rem', fontSize: '14px' }}>
            {error}
          </div>
        )}
        <p>{emptyMessage}</p>
      </div>
    );
  }

  // Filter routes by direction if specified
  const filteredRoutes = config.directionFilter && config.directionFilter !== 'Both'
    ? routes.filter(route => route.direction === config.directionFilter)
    : routes;

  // Group routes by direction (but only show the selected direction if filter is set)
  const morningRoutes = filteredRoutes.filter(route => route.direction === 'Morning');
  const afternoonRoutes = filteredRoutes.filter(route => route.direction === 'Afternoon');
  const otherRoutes = filteredRoutes.filter(route => !route.direction || (route.direction !== 'Morning' && route.direction !== 'Afternoon'));

  const toggleRouteExpand = (routeId: string) => {
    setExpandedRoutes(prev => {
      const next = new Set(prev);
      if (next.has(routeId)) {
        next.delete(routeId);
      } else {
        next.add(routeId);
      }
      return next;
    });
  };

  const toggleSection = (sectionName: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(sectionName)) {
        next.delete(sectionName);
      } else {
        next.add(sectionName);
      }
      return next;
    });
  };

  const getRouteNeighborhood = (route: Route): string => {
    // 1. Try to find the most frequent neighborhood among non-school stops
    const regularStops = route.stops.filter(s => !s.isSchoolStop && s.neighborhood);
    if (regularStops.length > 0) {
      const counts: Record<string, number> = {};
      regularStops.forEach(s => {
        if (s.neighborhood) {
          counts[s.neighborhood] = (counts[s.neighborhood] || 0) + 1;
        }
      });
      return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
    }

    // 2. Fallback to school stop neighborhood
    const schoolStop = route.stops.find(s => s.isSchoolStop && s.neighborhood);
    if (schoolStop?.neighborhood) return schoolStop.neighborhood;

    // 3. Fallback to any stop neighborhood
    const anyStop = route.stops.find(s => s.neighborhood);
    if (anyStop?.neighborhood) return anyStop.neighborhood;

    return 'Other';
  };

  const renderRouteGroups = (sectionRoutes: Route[]) => {
    // Group routes by neighborhood
    const groups: Record<string, Route[]> = {};
    sectionRoutes.forEach(route => {
      const neighborhood = getRouteNeighborhood(route);
      if (!groups[neighborhood]) {
        groups[neighborhood] = [];
      }
      groups[neighborhood].push(route);
    });

    // Sort neighborhoods alphabetically, but keep "Other" at the end
    const neighborhoodNames = Object.keys(groups).sort((a, b) => {
      if (a === 'Other') return 1;
      if (b === 'Other') return -1;
      return a.localeCompare(b);
    });

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {neighborhoodNames.map(neighborhood => (
          <div key={neighborhood}>
            <div className="eyebrow" style={{ marginBottom: '.75rem' }}>
              {neighborhood}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {groups[neighborhood].map(renderRoute)}
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderRoute = (route: Route) => {
    /**
     * isExpanded State (Route): True if the route stop list is currently open.
     * Impact: Chevron direction and visibility of stop list.
     */
    const isExpanded = expandedRoutes.has(route.id);
    const routeColor = config.getRouteColor?.(route) || route.color;
    /**
     * isRouteSelected State: True if this route is currently highlighted/selected (e.g., in School View).
     * Impact: Border (1px transparent vs border-color-darker), background (var(--bg-tertiary)), box-shadow.
     */
    const isRouteSelected = config.isRouteSelected?.(route) || false;
    const displayStops = getDisplayStops(route);
    // Count only non-school stops for the display count
    const regularStopCount = displayStops.filter(stop => !stop.isSchoolStop).length;

    return (
      <div
        key={route.id}
        className={`route-item ${isRouteSelected ? 'selected' : ''}`}
        onMouseDown={(e) => {
          if (config.showRouteSelection) {
            e.currentTarget.style.filter = 'brightness(0.9)';
          }
        }}
        onMouseUp={(e) => {
          if (config.showRouteSelection) {
            e.currentTarget.style.filter = 'none';
          }
        }}
        onMouseLeave={(e) => {
          if (config.showRouteSelection) {
            e.currentTarget.style.filter = 'none';
          }
        }}
      >
        <div style={{ display: 'flex', alignItems: 'stretch' }}>
          {/* Route header - can be customized via config */}
          {config.renderRouteHeader ? (
            config.renderRouteHeader(route)
          ) : (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.5rem 0.75rem',
                height: '40px',
                flex: 1,
                minWidth: 0,
                cursor: config.showRouteSelection ? 'pointer' : 'default',
              }}
              onClick={() => {
                if (config.showRouteSelection && config.onRouteSelectionChange) {
                  config.onRouteSelectionChange(route.id, !isRouteSelected);
                }
              }}
            >
              {config.showRouteSelection && (
                <div style={{ flexShrink: 0 }}>
                  <input
                    type="checkbox"
                    checked={isRouteSelected}
                    onChange={(e) => {
                      if (config.onRouteSelectionChange) {
                        config.onRouteSelectionChange(route.id, e.target.checked);
                      }
                    }}
                    onClick={(e) => e.stopPropagation()}
                    style={{ display: 'none' }}
                  />
                  <div
                    style={{
                      width: '16px',
                      height: '16px',
                      borderRadius: '50%',
                      // --- STYLES: Checkbox Background State ---
                      border: `1px solid ${isRouteSelected ? 'transparent' : 'var(--border-color-darker)'}`,
                      backgroundColor: isRouteSelected ? routeColor : 'transparent',
                      boxShadow: isRouteSelected ? 'none' : 'none',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    {isRouteSelected && (
                      <i className="fas fa-check" style={{ fontSize: '8px', color: 'white', textShadow: '0 1px 2px rgba(0, 0, 0, 0.3)' }}></i>
                    )}
                  </div>
                </div>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ marginBottom: '0.125rem', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <span style={{
                    // --- STYLES: Route Name State ---
                    color: isRouteSelected ? 'var(--text-primary)' : 'var(--text-tertiary)',
                    fontSize: '14px',
                    fontWeight: '600',
                    marginTop: '1px'
                  }}>
                    {route.name.replace('-upcoming', '')}
                  </span>
                  {route.name.includes('-upcoming') && route.effectiveDate && (
                    <span style={{
                      fontWeight: 'normal',
                      fontSize: '13px',
                      color: 'var(--text-tertiary)',
                      marginLeft: '2px',
                      marginTop: '1.5px'
                    }}>
                      ({formatEffectiveDate(route.effectiveDate)})
                    </span>
                  )}
                </div>
                {config.showGeocodingStats && route.geocodingProgress ? (
                  <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginBottom: '0.25rem' }}>
                    {route.geocodingProgress.geocoded}/{route.geocodingProgress.total} geocoded
                    {route.geocodingProgress.total - route.geocodingProgress.geocoded > 0 && (
                      <span style={{ color: '#ff6b6b', marginLeft: '0.5rem' }}>
                        ({route.geocodingProgress.total - route.geocodingProgress.geocoded} failed)
                      </span>
                    )}
                  </div>
                ) : null}
                {config.showFilename && route.filename && (
                  <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>
                    {route.filename}
                  </div>
                )}
              </div>
              {!config.showGeocodingStats && (
                <div style={{
                  fontSize: '13px',
                  color: 'var(--text-tertiary)',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                  opacity: 0.8
                }}>
                  {regularStopCount} {regularStopCount === 1 ? 'stop' : 'stops'}
                </div>
              )}
            </div>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleRouteExpand(route.id);
            }}
            style={{
              background: 'none',
              border: 'none',
              // --- STYLES: Border color Divider State ---
              borderLeft: `1px solid var(${isRouteSelected ? '--border-color-divider-selected' : '--border-color-divider-unselected'})`,
              padding: '0.5rem 0.75rem',
              cursor: 'pointer',
              color: 'var(--text-tertiary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              minWidth: '40px',
            }}
            title={isExpanded ? 'Collapse' : 'Expand'}
          >
            {/* --- STYLES: Chevron State --- */}
            <ChevronIcon direction={isExpanded ? 'up' : 'down'} size={10} />
          </button>
        </div>

        {/* --- STATE: EXPANDED STOPS LIST --- */}
        {/* Only rendered when a route is manually expanded by the user */}
        {/* --- STATE: Expanded stops visibility --- */}
        {isExpanded && (
          <div className="stop-list">
            {displayStops.map((stop, index) =>
              renderStopItem(stop, route, index, displayStops, config)
            )}
          </div>
        )}
      </div>
    );
  };

  const renderSection = (sectionName: string, sectionRoutes: Route[], color?: string) => {
    if (sectionRoutes.length === 0) return null;

    /**
     * isExpanded State (Section): True if the Morning/Afternoon section is open.
     */
    const isExpanded = expandedSections.has(sectionName);

    return (
      <div key={sectionName}>
        <button
          onClick={() => toggleSection(sectionName)}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0.75rem 0',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            textAlign: 'left',
            marginBottom: '0.75rem',
          }}
        >
          <h3 style={{
            margin: 0,
            fontSize: '1rem',
            fontWeight: '600',
            color: color || 'var(--text-secondary)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}>
            {sectionName === 'Morning' && (
              <span style={{
                fontSize: '14px',
                padding: '4px 10px',
                borderRadius: '12px',
                fontWeight: '500',
                backgroundColor: '#B3E5FC',
                color: '#01579B',
                transition: 'opacity 0.3s ease',
              }}>
                Morning
              </span>
            )}
            {sectionName === 'Afternoon' && (
              <span style={{
                fontSize: '14px',
                padding: '4px 10px',
                borderRadius: '12px',
                fontWeight: '500',
                backgroundColor: '#C8E6C9',
                color: '#1B5E20',
                transition: 'opacity 0.3s ease',
              }}>
                Afternoon
              </span>
            )}
            {sectionName !== 'Morning' && sectionName !== 'Afternoon' && (
              <span>{sectionName}</span>
            )}
            <span style={{ fontWeight: '400', color: 'var(--text-tertiary)' }}>({sectionRoutes.length})</span>
          </h3>
          <ChevronIcon direction={isExpanded ? 'up' : 'down'} size={12} />
        </button>
        {isExpanded && renderRouteGroups(sectionRoutes)}
      </div>
    );
  };

  return (
    <div style={{ padding: '1rem' }}>
      {error && (
        <div style={{ color: '#ff6b6b', marginBottom: '1rem', fontSize: '14px' }}>
          {error}
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {config.directionFilter === 'Both' || !config.directionFilter ? (
          <>
            {renderSection('Morning', morningRoutes, '#01579B')}
            {renderSection('Afternoon', afternoonRoutes, '#1B5E20')}
            {renderSection('Other', otherRoutes)}
          </>
        ) : (
          // When a specific direction is selected, show all routes of that direction in a single consolidated list
          renderRouteGroups(filteredRoutes)
        )}
      </div>
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
