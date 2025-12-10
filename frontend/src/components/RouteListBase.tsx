import { useState, ReactNode } from 'react';
import { formatStreetName } from '../utils/formatAddress';
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

/**
 * Calculate stop number for a stop, excluding school stops and skipped stops
 */
function calculateStopNumber(
  stop: Stop,
  allStops: Stop[],
  stopIndex: number
): number {
  if (stop.isSchoolStop) {
    return 0; // School stop is always 0 (but won't be displayed)
  }
  
  // Count how many regular (non-school, non-skipped) stops come before this one
  const displayStops = allStops.filter(s => !s.skipGeocoding);
  let regularStopCount = 0;
  for (let i = 0; i < stopIndex; i++) {
    const s = displayStops[i];
    if (!s.isSchoolStop) {
      regularStopCount++;
    }
  }
  return regularStopCount + 1; // Number starts at 1
}

/**
 * Render a single stop item
 */
function renderStopItem(
  stop: Stop,
  route: Route,
  stopIndex: number,
  allStops: Stop[],
  config: RouteListConfig
) {
  const stopNumber = calculateStopNumber(stop, allStops, stopIndex);
  const hasCoordinates = stop.coordinates && stop.coordinates.length === 2;
  const hasError = config.showStopErrors && (!hasCoordinates || stop.geocodeError);
  const isClickable = hasCoordinates;
  const isSelected = config.isStopSelected?.(route, stop) || false;
  const routeColor = config.getRouteColor?.(route) || route.color;

  return (
    <div
      key={stop.id}
      onClick={() => {
        if (isClickable && config.onStopClick) {
          config.onStopClick(route, stop, stopNumber);
        }
      }}
      style={{
        padding: '0.75rem',
        paddingLeft: '0.75rem',
        borderBottom: stopIndex < allStops.length - 1 ? '1px solid var(--border-color)' : 'none',
        cursor: isClickable ? 'pointer' : 'default',
        backgroundColor: hasError
          ? '#ffe6e6'
          : isSelected
          ? '#e3f2fd'
          : isClickable
          ? 'transparent'
          : 'var(--bg-secondary)',
        borderLeft: isSelected ? '3px solid #4ECDC4' : hasError ? '3px solid #ff6b6b' : 'none',
        transition: 'background-color 0.15s',
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
      }}
      onMouseEnter={(e) => {
        if (isClickable) {
          e.currentTarget.style.backgroundColor = hasError ? '#ffcccc' : '#e3f2fd';
        }
      }}
      onMouseLeave={(e) => {
        if (!isSelected && isClickable) {
          e.currentTarget.style.backgroundColor = hasError ? '#ffe6e6' : 'transparent';
        }
      }}
    >
      {/* Stop icon/number */}
      {stop.isSchoolStop ? (
        <div style={{ 
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '18px',
          height: '18px',
          borderRadius: '50%',
          backgroundColor: hasError ? '#ff6b6b' : routeColor,
          color: 'white',
          fontSize: '14px',
          flexShrink: 0,
        }}>
          <i className="fas fa-graduation-cap" style={{ fontSize: '9px' }}></i>
        </div>
      ) : (
        <div style={{ 
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '18px',
          height: '18px',
          borderRadius: '50%',
          backgroundColor: hasError ? '#ff6b6b' : routeColor,
          color: 'white',
          fontSize: '9px',
          fontWeight: 'bold',
          flexShrink: 0,
        }}>
          {stopNumber}
        </div>
      )}
      
      {/* Stop details */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ 
          fontSize: '12px',
          fontWeight: '500',
          color: hasError ? '#ff6b6b' : (isClickable ? 'var(--text-secondary)' : 'var(--text-tertiary)'),
        }}>
          {stop.isSchoolStop && stop.schoolName 
            ? stop.schoolName 
            : formatStreetName(stop.address)}
        </div>
        {config.showStopErrors && hasError && (
          <div style={{ fontSize: '10px', color: '#ff6b6b', fontStyle: 'italic', marginTop: '0.25rem' }}>
            ✗ {stop.geocodeError || 'No coordinates'}
          </div>
        )}
        {config.showStopErrors && !hasError && !stop.isSchoolStop && (
          <div style={{ fontSize: '10px', color: '#4caf50', marginTop: '0.25rem' }}>
            ✓ Geocoded
          </div>
        )}
        {!hasCoordinates && !stop.isSchoolStop && !config.showStopErrors && (
          <div style={{ fontSize: '10px', color: 'var(--text-tertiary)', fontStyle: 'italic', marginTop: '0.25rem' }}>
            No coordinates
          </div>
        )}
      </div>
      {/* Time on the right */}
      {stop.time && (
        <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginRight: '0.5rem', flexShrink: 0 }}>
          {stop.time}
        </div>
      )}
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
              border: '3px solid #4ECDC4',
              borderTopColor: 'transparent',
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

  const renderRoute = (route: Route) => {
    const isExpanded = expandedRoutes.has(route.id);
    const routeColor = config.getRouteColor?.(route) || route.color;
    const isRouteSelected = config.isRouteSelected?.(route) || false;
    const displayStops = route.stops.filter(stop => !stop.skipGeocoding);

    return (
      <div
        key={route.id}
        style={{
          border: '1px solid var(--border-color)',
          borderRadius: '4px',
          backgroundColor: isRouteSelected ? 'var(--bg-tertiary)' : 'var(--bg-primary)',
          overflow: 'hidden',
          transition: 'background-color 0.3s ease, border-color 0.3s ease',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'stretch' }}>
          {/* Route header - can be customized via config */}
          {config.renderRouteHeader ? (
            config.renderRouteHeader(route)
          ) : (
            <div
              onClick={() => {
                toggleRouteExpand(route.id);
                // Also toggle route selection if route selection is enabled
                if (config.showRouteSelection && config.onRouteSelectionChange) {
                  config.onRouteSelectionChange(route.id, !route.isSelected);
                }
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.75rem',
                flex: 1,
                minWidth: 0,
                cursor: 'pointer',
                transition: 'background-color 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--bg-secondary)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              {config.showRouteSelection && (
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    cursor: 'pointer',
                    flexShrink: 0,
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <input
                    type="checkbox"
                    checked={route.isSelected}
                    onChange={(e) => {
                      if (config.onRouteSelectionChange) {
                        config.onRouteSelectionChange(route.id, e.target.checked);
                      }
                    }}
                    style={{ display: 'none' }}
                  />
                  <div
                    style={{
                      width: '18px',
                      height: '18px',
                      borderRadius: '50%',
                      border: `2px solid ${routeColor}`,
                      backgroundColor: route.isSelected ? routeColor : 'transparent',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      boxSizing: 'border-box',
                    }}
                  >
                    {route.isSelected && (
                      <i className="fas fa-check" style={{ fontSize: '9px', color: 'white' }}></i>
                    )}
                  </div>
                </label>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: '500', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <span style={{ color: 'var(--text-primary)' }}>{route.name}</span>
                </div>
                {config.showGeocodingStats && route.geocodingProgress && (
                  <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '0.25rem' }}>
                    {route.geocodingProgress.geocoded}/{route.geocodingProgress.total} geocoded
                    {route.geocodingProgress.total - route.geocodingProgress.geocoded > 0 && (
                      <span style={{ color: '#ff6b6b', marginLeft: '0.5rem' }}>
                        ({route.geocodingProgress.total - route.geocodingProgress.geocoded} failed)
                      </span>
                    )}
                  </div>
                )}
                {config.showFilename && route.filename && (
                  <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '0.25rem' }}>
                    {route.filename}
                  </div>
                )}
              </div>
              {!config.showGeocodingStats && (
                <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginRight: '0.5rem', flexShrink: 0 }}>
                  {displayStops.length} stops
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
              borderLeft: '1px solid var(--border-color)',
              padding: '0.75rem',
              cursor: 'pointer',
              color: 'var(--text-tertiary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              minWidth: '40px',
            }}
            title={isExpanded ? 'Collapse' : 'Expand'}
          >
            <i 
              className="fas fa-chevron-down"
              style={{ 
                transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.2s',
                display: 'inline-block',
                fontSize: '12px',
              }}
            />
          </button>
        </div>
        
        {/* Expanded stops list */}
        {isExpanded && (
          <div style={{ 
            borderTop: '1px solid var(--border-color)',
            backgroundColor: isRouteSelected ? 'var(--bg-tertiary)' : 'var(--bg-secondary)',
            maxHeight: '400px',
            overflowY: 'auto',
            transition: 'background-color 0.3s ease, border-color 0.3s ease',
          }}>
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
          <i 
            className="fas fa-chevron-down"
            style={{ 
              transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.2s',
              display: 'inline-block',
              fontSize: '12px',
              color: 'var(--text-tertiary)',
            }}
          />
        </button>
        {isExpanded && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {sectionRoutes.map(renderRoute)}
          </div>
        )}
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {filteredRoutes.map(renderRoute)}
          </div>
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

