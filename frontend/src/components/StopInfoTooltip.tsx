import React, { useState } from 'react';
import { Route, Stop } from '../types';
import { formatStreetName, extractStreetNames } from '../utils/formatAddress';
import { handleMapLinkClick } from '../utils/mapLinks';
import { formatEffectiveDate } from '../utils/dateUtils';
import { useIsMobile } from '../hooks/useMediaQuery';
import { analyticsService } from '../services/analytics';
import { MapPinIcon } from './MapPinIcon';
import { getSchoolDisplayName } from '../utils/schoolUtils';
import { XIcon } from './XIcon';
import { CollapsibleBody } from './MapInfoPanel';

interface StopInfoTooltipProps {
  route: Route;
  stop: Stop;
  stopNumber: number;
  enableStreetHighlighting?: boolean;
  highlightedStreetName?: string;
  loadingStreet?: string;
  streetError?: string;
  onStreetClick?: (streetName: string) => void;
  onClose: () => void;
  // Admin features
  enableStreetPins?: boolean;
  loadingStreetPins?: boolean;
  onDropStreetPins?: () => void;
  editingMode?: boolean;
  undoHistoryCount?: number;
  onUndo?: () => void;
}

interface StopPillProps {
  number: number;
  time?: string;
  color: string;
}

/* ========================================
 * STOP PILL COMPONENT
 * Displays: "Stop" label + numbered circle + optional time
 * ======================================== */
const StopPill: React.FC<StopPillProps> = ({ number, time, color }) => {
  const hasTime = !!time && time.trim().length > 0;

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      height: '24px',
    }}>
      {/* --- "Stop" Label --- */}
      <span style={{
        fontSize: '13px',
        fontWeight: '600',
        color: 'var(--text-primary)',
        marginRight: '0'
      }}>
        Stop
      </span>
      
      {/* --- Stop Number Circle --- 
       * Style: Transparent with border, primary text
       */}
      <div style={{
        width: '20px',
        height: '20px',
        backgroundColor: 'transparent',
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--text-primary)',
        fontSize: '11px',
        fontWeight: 'bold',
        border: '1px solid var(--text-tertiary  )',
      }}>
        {number}
      </div>
      
      {/* --- Time Display (conditional) --- 
       * Only shown when time is provided and not empty
       */}
      {hasTime && (
        <span style={{
          whiteSpace: 'nowrap',
          fontSize: '13px',
          fontWeight: '600',
          color: 'var(--text-primary)'
        }}>
          {time}
        </span>
      )}
    </div>
  );
};

import { Button } from './Button';

export const StopInfoTooltip: React.FC<StopInfoTooltipProps> = ({
  route,
  stop,
  stopNumber,
  enableStreetHighlighting = false,
  highlightedStreetName,
  loadingStreet,
  streetError,
  onStreetClick,
  onClose,
  enableStreetPins = false,
  loadingStreetPins = false,
  onDropStreetPins,
  editingMode = false,
  undoHistoryCount = 0,
  onUndo,
}) => {
  const isMobile = useIsMobile();
  const [copied, setCopied] = useState(false);
  const streets = extractStreetNames(stop.address);
  const formattedAddress = formatStreetName(stop.address);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(stop.address);
    setCopied(true);
    analyticsService.trackAction('copy_address', { address: stop.address, context: 'stop_tooltip' });
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    /* ========================================
     * MAIN CONTAINER
     * ======================================== */
    <div style={{
      /* --- Mobile State --- */
      minWidth: isMobile ? 'auto' : '280px',
      maxWidth: isMobile ? 'none' : '350px',
      width: isMobile ? '100%' : 'auto',
      borderRadius: isMobile ? '0' : 'var(--radius-floating)',
      boxShadow: isMobile ? 'none' : 'var(--drop-shadow-floating-primary)',
      border: isMobile ? 'none' : 'none',
      
      /* --- Common Styles --- */
      backgroundColor: 'var(--bg-secondary)',
      color: 'var(--text-primary)',
      overflow: 'hidden',
      pointerEvents: 'auto',
      fontFamily: "'Inter', sans-serif"
    }}>
      {/* ========================================
       * HEADER SECTION
       * Contains: Route name, effective date, stop pill, close button
       * ======================================== */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        padding: isMobile ? '0px 2rem 12px 2rem' : 'var(--floating-header-padding)',
        backgroundColor: 'var(--bg-primary)',
        position: 'relative',
        borderBottom: 'none'
      }}>
        {/* --- Route Name & Stop Info --- */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '2px' }}>
          {/* Route Name (responsive sizing) */}
          <span style={{ fontWeight: '500', fontSize: isMobile ? '26px' : '18px', letterSpacing: '-0.025em', lineHeight: '22px' }}>
            Route {route.name.replace('-upcoming', '')}
            {/* Effective Date Badge (only shown for upcoming routes) */}
            {route.name.includes('-upcoming') && route.effectiveDate && (
              <span style={{
                fontWeight: 'normal',
                fontSize: '13px',
                color: 'var(--text-tertiary)',
                marginLeft: '6px',
                marginTop: '1.5px',
                display: 'inline-block'
              }}>
                ({formatEffectiveDate(route.effectiveDate)})
              </span>
            )}
          </span>
          {/* Stop Pill (only shown for numbered stops) */}
          {stopNumber > 0 && (
            <div style={{ marginBottom: isMobile ? '14px' : '0px', marginTop: '4px' }}>
              <StopPill number={stopNumber} time={stop.time} color={route.color} />
            </div>
          )}
        </div>
        
        {/* --- Close Button (desktop only) --- */}
        {!isMobile && (
          <button
            onClick={(e) => { e.stopPropagation(); onClose(); }}
            style={{
              /* CLOSE BUTTON STATES:
               * Default: color = var(--text-tertiary)
               * Hover: (handled by :hover CSS in index.css)
               */
              background: 'none',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-tertiary)',
              cursor: 'pointer',
              padding: '4px',
              position: 'absolute',
              top: isMobile ? '3px' : '30px',
              right: isMobile ? '22px' : '34px',
              transition: 'color 0.2s ease',
              zIndex: 10,
              lineHeight: 1
            }}
            aria-label="Close dialog"
          >
            <XIcon />
          </button>
        )}
      </div>

      <CollapsibleBody>
      {/* ========================================
       * MAIN CONTENT SECTION
       * Contains: Address, Neighborhood
       * Note: School stops don't use this tooltip (they show SchoolInfoTooltip)
       * ======================================== */}
      <div style={{
        padding: isMobile ? '20px 2rem' : 'var(--floating-content-padding)',
        backgroundColor: 'var(--bg-secondary)',
        }}>
        <div style={{ display: 'grid', gap: '1rem', backgroundColor: 'var(--bg-secondary)' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

            {/* --- ADDRESS SECTION --- */}
            <div style={{ fontSize: isMobile ? '16px' : '13px', marginTop: isMobile ? '16px' : '5px' }}>
              <div className="eyebrow">Address</div>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                <div style={{ color: 'var(--text-primary)', fontWeight: '500', lineHeight: '1.4' }}>

                  {/* ADDRESS DISPLAY STATES:
                   * 1. School Stop: Shows school name (NOTE: Never happens - school stops use SchoolInfoTooltip)
                   * 2. Street Highlighting Enabled: Shows interactive street names
                   * 3. Default: Shows formatted address
                   */}
                  {stop.isSchoolStop && stop.schoolName ? (
                    /* State 1: School Stop - Bold school name (defensive code, shouldn't reach here) */
                    getSchoolDisplayName(stop.schoolName)
                  ) : enableStreetHighlighting && streets.length > 0 ? (
                    /* State 2: Interactive Street Names */
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {streets.map((streetName, index) => {
                        const isHighlighted = highlightedStreetName === streetName;
                        const isLoading = loadingStreet === streetName;

                        return (
                          <div key={index} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            {/* Ampersand separator between streets */}
                            {index > 0 && <span style={{ color: 'var(--text-tertiary)', fontSize: '12px' }}>&</span>}

                            {/* STREET NAME STATES:
                             * - Default: var(--text-primary)
                             * - Hover: route.color
                             * - Highlighted: #FFD700 (gold)
                             * - Loading: var(--text-tertiary) + spinner
                             * - Loading cursor: not-allowed
                             * - Interactive cursor: pointer
                             */}
                            <span
                              onClick={() => {
                                if (!isLoading) {
                                  analyticsService.trackAction('street_highlight_click', { street: streetName });
                                  onStreetClick?.(streetName);
                                }
                              }}
                              style={{
                                cursor: isLoading ? 'not-allowed' : 'pointer',
                                color: isHighlighted ? '#FFD700' : isLoading ? 'var(--text-tertiary)' : 'var(--text-primary)',
                                transition: 'color 0.2s ease',
                              }}
                              onMouseEnter={(e) => { if (!isLoading) e.currentTarget.style.color = route.color; }}
                              onMouseLeave={(e) => { if (!isLoading) e.currentTarget.style.color = isHighlighted ? '#FFD700' : 'var(--text-primary)'; }}
                            >
                              {formatStreetName(streetName)}
                              {/* Loading spinner */}
                              {isLoading && <i className="fas fa-circle-notch fa-spin" style={{ marginLeft: '6px', fontSize: '10px' }}></i>}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    /* State 3: Default formatted address */
                    formattedAddress
                  )}
                </div>
              </div>
            </div>

            {/* --- NEIGHBORHOOD SECTION (conditional) --- */}
            {stop.neighborhood && (
              <div style={{ fontSize: isMobile ? '16px' : '13px' }}>
                <div className="eyebrow">Neighborhood</div>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                  <div style={{ color: 'var(--text-primary)', fontWeight: '500' }}>{stop.neighborhood}</div>
                </div>
              </div>
            )}
          </div>
        </div>
        </div>
        {/* ========================================
         * ACTION BUTTONS
         * Contains: Directions button, Copy address button
         * ======================================== */}
        <div style={{
            display: 'flex',
            gap: '10px',
            marginTop: '0rem',
            backgroundColor: 'var(--bg-secondary)',
            padding: isMobile ? '0 30px 4px' : '0 24px 24px'
            }}>

          {/* --- Directions Button (opens Google Maps) --- */}
          <Button
            variant="primary"
            size="medium"
            fullWidth
            align="center"
            onClick={(e) => {
              analyticsService.trackOutboundLink(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(stop.address)}`, 'maps');
              handleMapLinkClick(e, stop.address, stop.coordinates);
            }}
            icon={<i className="fas fa-directions" style={{ opacity: 0.7 }}></i>}
          >
            Directions
          </Button>

          {/* --- Copy Address Button ---
           * BUTTON STATES:
           * - Default: "Copy" text, fa-copy icon
           * - Copied: "Copied" text, fa-check icon (green), auto-resets after 2s
           */}
          <Button
            variant="primary"
            size="medium"
            fullWidth
            align="center"
            onClick={handleCopy}
            icon={<i className={`fas ${copied ? 'fa-check' : 'fa-copy'}`} style={{ opacity: 0.7, color: copied ? '#4CAF50' : 'inherit' }}></i>}
          >
            {copied ? 'Copied' : 'Copy'}
          </Button>
        </div>


      {/* ========================================
       * ADMIN TOOLS SECTION (conditional)
       * Shows when: enableStreetPins OR (editingMode + undoHistory)
       * Contains: Drop Street Pins button, Undo Changes button
       * ======================================== */}
      {(enableStreetPins || (editingMode && undoHistoryCount > 0)) && (
        <div style={{
          padding: '24px 34px',
          backgroundColor: 'rgba(78, 205, 196, 0.05)', // Light teal tint
          borderTop: '1px solid var(--border-color-tertiary)',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}>
          {/* --- Admin Section Header --- */}
          <div style={{
            fontSize: '10px',
            fontWeight: '700',
            color: 'var(--text-tertiary)',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            marginBottom: '4px'
          }}>
            Admin Tools
          </div>

          {/* --- Drop Street Pins Button ---
           * BUTTON STATES:
           * - Default: "Drop Pins on Streets", fa-map-marker-alt icon
           * - Loading: "Dropping pins...", fa-circle-notch fa-spin icon, disabled
           * Only shown for: non-school stops with street names
           */}
          {enableStreetPins && !stop.isSchoolStop && streets.length > 0 && (
            <Button
              variant="primary"
              size="small"
              fullWidth
              align="left"
              onClick={() => {
                analyticsService.trackAdminAction('drop_street_pins', stop.address);
                onDropStreetPins?.();
              }}
              disabled={loadingStreetPins}
              icon={<i className={`fas ${loadingStreetPins ? 'fa-circle-notch fa-spin' : 'fa-map-marker-alt'}`}></i>}
            >
              {loadingStreetPins ? 'Dropping pins...' : 'Drop Pins on Streets'}
            </Button>
          )}

          {/* --- Undo Changes Button ---
           * Shows count of undo operations available
           * Only shown when: in editing mode with undo history
           */}
          {editingMode && undoHistoryCount > 0 && (
            <Button
              variant="primary"
              size="small"
              fullWidth
              align="left"
              onClick={() => {
                analyticsService.trackAdminAction('undo_coordinate_change', stop.id);
                onUndo?.();
              }}
              icon={<i className="fas fa-undo"></i>}
            >
              Undo Changes ({undoHistoryCount})
            </Button>
          )}
        </div>
      )}
      </CollapsibleBody>
    </div>
  );
};
