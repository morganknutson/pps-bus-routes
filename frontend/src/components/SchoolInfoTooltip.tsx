/*--------------------------------
   React and Router Imports
----------------------------------*/
import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

/*--------------------------------
   Type Definitions
----------------------------------*/
import { School } from '../types';

/*--------------------------------
   Utility Functions
----------------------------------*/
import { getSchoolTypes, getSchoolColor, getSchoolDisplayName } from '../utils/schoolUtils';
import { handleMapLinkClick } from '../utils/mapLinks';
import { formatDate } from '../utils/dateUtils';

/*--------------------------------
   Custom Hooks
----------------------------------*/
import { useIsMobile } from '../hooks/useMediaQuery';
import { useUrlState } from '../hooks/useUrlState';

/*--------------------------------
   State Management
----------------------------------*/
import { useStore } from '../store/useStore';

/*--------------------------------
   Services
----------------------------------*/
import { analyticsService } from '../services/analytics';

/*--------------------------------
   Component Imports
----------------------------------*/
import { RouteIcon } from './RouteIcon';
import { XIcon } from './XIcon';
import { Button } from './Button';

/*--------------------------------
   Component Props Interface
   - school: School object containing all school data
   - showRoutesButton: Optional flag to display routes button
   - onViewRoutes: Optional callback when routes button is clicked
   - onClose: Optional callback when tooltip is closed
   - message: Optional message to display instead of full tooltip
----------------------------------*/
interface SchoolInfoTooltipProps {
  school: School;
  showRoutesButton?: boolean;
  onViewRoutes?: () => void;
  onClose?: () => void;
  message?: string;
}

/*--------------------------------
   SchoolInfoTooltip Component
   Displays detailed information about a school in a tooltip/modal format
----------------------------------*/
export const SchoolInfoTooltip: React.FC<SchoolInfoTooltipProps> = ({
  school,
  showRoutesButton = false,
  onViewRoutes,
  onClose,
  message
}) => {
  /*--------------------------------
     Early Return: Null Check
     Returns null if school prop is not provided
  ----------------------------------*/
  if (!school) return null;

  /*--------------------------------
     Hook: Mobile Detection
     Determines if the current viewport is mobile-sized
  ----------------------------------*/
  const isMobile = useIsMobile();

  /*--------------------------------
     Hook: React Router Location
     Gets current route location for path-based logic
  ----------------------------------*/
  const location = useLocation();

  /*--------------------------------
     State: Dark Mode
     Retrieves dark mode state from Zustand store
  ----------------------------------*/
  const isDarkMode = useStore(state => state.isDarkMode);

  /*--------------------------------
     Variable: Base Path
     Determines base path for URL state management (admin vs regular)
  ----------------------------------*/
  const basePath = location.pathname.startsWith('/admin') ? '/admin' : '';

  /*--------------------------------
     Hook: URL State Management
     Provides function to navigate to school routes view
  ----------------------------------*/
  const { viewSchoolRoutes } = useUrlState({ basePath });

  /*--------------------------------
     Variable: School Types
     Gets school types from school object or derives from name
  ----------------------------------*/
  const schoolTypes = school.schoolTypes || getSchoolTypes(school.name);

  /*--------------------------------
     Variable: School Color
     Gets color associated with school types for styling
  ----------------------------------*/
  const schoolColor = getSchoolColor(schoolTypes);

  /*--------------------------------
     Event Handler: View Routes
     Handles click on routes button, navigates to routes view
  ----------------------------------*/
  const handleViewRoutes = (e: React.MouseEvent) => {
    e.stopPropagation();
    viewSchoolRoutes(school.id);
    if (onViewRoutes) onViewRoutes();
  };

  /*--------------------------------
     Conditional Render: Message Mode
     If message prop is provided, render simplified message view
  ----------------------------------*/
  if (message) {
    return (
      /*--------------------------------
         Container: Message Tooltip
         Wrapper div for message display with responsive styling
      ----------------------------------*/
      <div style={{
        minWidth: isMobile ? 'auto' : '200px',
        maxWidth: isMobile ? 'none' : '300px',
        width: isMobile ? '100%' : 'auto',
        fontSize: '13px',
        backgroundColor: 'var(--bg-primary)',
        color: 'var(--text-primary)',
        borderRadius: isMobile ? '0' : 'var(--radius-floating)',
        boxShadow: isMobile ? 'none' : 'var(--drop-shadow-quinary)',
        border: isMobile ? 'none' : 'none',
        padding: 'var(--floating-content-padding)',
        pointerEvents: 'auto',
      }}>
        {/*--------------------------------
           Container: Message Content
           Flex container for icon and message text
        ----------------------------------*/}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '0.75rem', 
          minWidth: isMobile ? 'auto' : '200px'
          }}>
          {/*--------------------------------
             Container: Icon Circle
             Circular background for route icon
          ----------------------------------*/}
          <div style={{ 
            width: '32px', 
            height: '32px', 
            borderRadius: '16px', 
            backgroundColor: 'var(--bg-tertiary)', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            flexShrink: 0 
            }}>
            {/*--------------------------------
               Component: Route Icon
               Displays route icon in message mode
            ----------------------------------*/}
            <RouteIcon size={14} color="var(--text-tertiary)" />
          </div>
          {/*--------------------------------
             Element: Message Text
             Displays the message prop text
          ----------------------------------*/}
          <div style={{ 
            fontSize: '13px', 
            color: 'var(--text-primary)', 
            lineHeight: '1.4', 
            fontWeight: '600' 
            }}>{message}</div>
        </div>
      </div>
    );
  }

  /*--------------------------------
     Main Return: Full Tooltip View
     Renders complete school information tooltip
  ----------------------------------*/
  return (
    /*--------------------------------
       Container: Tooltip Root
       Main wrapper with responsive sizing and styling
    ----------------------------------*/
    <div style={{
      minWidth: isMobile ? 'auto' : '280px',
      maxWidth: isMobile ? 'none' : '345px',
      width: isMobile ? '100%' : 'auto',
      backgroundColor: 'var(--bg-secondary)',
      color: 'var(--text-primary)',
      borderRadius: isMobile ? '0' : 'var(--radius-floating)',
      overflow: 'hidden',
      boxShadow: isMobile ? 'none' : 'var(--drop-shadow-floating-primary)',
      border: isMobile ? 'none' : 'none',
      pointerEvents: 'auto',
      
    }}>
      {/*--------------------------------
         Container: Header Section
         Header area with school name, types, and close button
      ----------------------------------*/}
      <div style={{
        padding: isMobile ? '8px 2rem 12px 2rem' : 'var(--floating-header-padding)',
        backgroundColor: 'var(--bg-primary)',
        borderBottom: 'none',
        position: 'relative',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: '1rem'
      }}>
        {/*--------------------------------
           Container: Header Content
           Flex container for school name and types
        ----------------------------------*/}
        <div style={{ flex: 1 }}>
          {/*--------------------------------
             Element: School Name Heading
             Displays formatted school name
          ----------------------------------*/}
          <h3 style={{ 
            margin: isMobile ? '0 0 0.75rem 0' : '0 0 0.25rem 0', 
            fontSize: isMobile ? '26px' : '18px', 
            fontWeight: '600', 
            letterSpacing: '-0.025em', 
            lineHeight: '22px', 
            color: 'var(--text-primary)',
            
            }}>
            {getSchoolDisplayName(school.name)}
          </h3>
          {/*--------------------------------
             Container: School Types
             Displays school type(s) with icon and color
          ----------------------------------*/}
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '.5rem', 
            color: schoolColor, 
            fontSize: '12px', 
            fontWeight: '500', 
            marginTop: '0.2rem', 
            marginBottom: isMobile ? '14px' : '0', 
             }}>
            {/*--------------------------------
               Icon: Graduation Cap
               Font Awesome icon for school types
            ----------------------------------*/}
            <i className="fas fa-graduation-cap" style={{ 
              fontSize: '10px', 
              width: '10px', 
              flexShrink: 0,
              
              }}></i>
            {/*--------------------------------
               Element: School Types Text
               Displays joined school types
            ----------------------------------*/}
            <span>{schoolTypes.join(' & ')}</span>
          </div>
        </div>

        {/*--------------------------------
           Conditional Render: Close Button
           Only shows on desktop when onClose prop is provided
        ----------------------------------*/}
        {onClose && !isMobile && (
          <button
            onClick={(e) => { e.stopPropagation(); onClose(); }}
            style={{ 
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
              lineHeight: 1, 
               
            }}
            aria-label="Close dialog"
          >
            {/*--------------------------------
               Component: X Icon
               Close button icon component
            ----------------------------------*/}
            <XIcon />
          </button>
        )}
      </div>

      {/*--------------------------------
         Container: Content Section
         Main content area with school details
      ----------------------------------*/}
      <div style={{ 
        padding: isMobile ? '1.5rem 2rem' : 'var(--floating-content-padding)',
        }}>
        {/*--------------------------------
           Container: Content Grid
           Grid layout for organizing content sections
        ----------------------------------*/}
        <div style={{ 
          display: 'grid', 
          gap: '1rem',
          }}>
          {/*--------------------------------
             Container: Details Column
             Vertical flex container for school details
          ----------------------------------*/}
          <div style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            gap: '1.5rem',
            }}>
            {/*--------------------------------
               Conditional Render: Neighborhood
               Displays neighborhood if available
            ----------------------------------*/}
            {school.neighborhood && (
              <div style={{ fontSize: isMobile ? '16px' : '13px' }}>
                {/*--------------------------------
                   Element: Neighborhood Label
                   Eyebrow text for neighborhood section
                ----------------------------------*/}
                <div className="eyebrow">Neighborhood</div>
                {/*--------------------------------
                   Container: Neighborhood Content
                   Flex container for neighborhood value
                ----------------------------------*/}
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'flex-start', 
                  gap: '0.5rem',
                  
                  }}>
                  {/*--------------------------------
                     Element: Neighborhood Text
                     Displays school neighborhood name
                  ----------------------------------*/}
                  <div style={{ 
                    color: 'var(--text-primary)', 
                    fontWeight: '500',
                    }}>{school.neighborhood}</div>
                </div>
              </div>
            )}

            {/*--------------------------------
               Conditional Render: Address
               Displays address as clickable link if available
            ----------------------------------*/}
            {school.address && (
              <div style={{ 
                fontSize: isMobile ? '16px' : '13px' 
                }}>
                {/*--------------------------------
                   Element: Address Label
                   Eyebrow text for address section
                ----------------------------------*/}
                <div className="eyebrow">Address</div>
                {/*--------------------------------
                   Container: Address Content
                   Flex container for address link
                ----------------------------------*/}
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                  {/*--------------------------------
                     Element: Address Link
                     Clickable link to open address in maps
                  ----------------------------------*/}
                  <a
                    href="#"
                    onClick={(e) => {
                      analyticsService.trackOutboundLink(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(school.address!)}`, 'maps');
                      handleMapLinkClick(e, school.address!, school.coordinates);
                    }}
                    style={{ 
                      color: 'var(--text-primary)', 
                      textDecoration: 'none', 
                      fontWeight: '500', 
                      display: 'block' 
                    }}
                  >
                    {school.address}
                  </a>
                </div>
              </div>
            )}

            {/*--------------------------------
               Conditional Render: Update Date
               Displays last routes update timestamp if available
            ----------------------------------*/}
            {/* HIDDEN: Update badge
            {school.routesUpdatedAt && (
              <div style={{ 
                fontSize: '11px', 
                color: 'var(--text-tertiary)', 
                display: 'flex', 
                alignItems: 'center', 
                gap: '.5em' 
                }}>
                <i className="fas fa-clock" style={{ fontSize: '12px', opacity: 0.7 }}></i>
                <span>Updated {formatDate(school.routesUpdatedAt)}</span>
              </div>
            )}
            */}
          </div>
        </div>

        {/*--------------------------------
           Conditional Render: Routes Button
           Shows button to view routes if routeCount is defined and showRoutesButton is true
        ----------------------------------*/}
        {school.routeCount !== undefined && showRoutesButton && (
          <div style={{ marginLeft: '-10px', marginRight: '-10px', marginTop: '2em' }}>
            {/*--------------------------------
               Component: Routes Button
               Primary button to navigate to routes view
            ----------------------------------*/}
            <Button
              variant="primary"
              size="large"
              fullWidth
              align="left"
              onClick={handleViewRoutes}
              icon={<RouteIcon color={school.routeCount === 0 ? '#f44' : 'currentColor'} />}
              showChevron={school.routeCount! > 0}
            >
              {school.routeCount === 0 ? 'Route information not provided' : `Explore ${school.routeCount} ${school.routeCount === 1 ? 'Route' : 'Routes'}`}
            </Button>
          </div>
        )}

        {/*--------------------------------
           Conditional Render: Footer Links
           Shows school website and PDF links if available
        ----------------------------------*/}
        {/* HIDDEN: School Website and PDF links
        {(school.schoolPageLink || school.driveLink) && (
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            gap: '1rem', 
            marginTop: '1rem', 
            paddingTop: '1rem' 
            }}>
            {school.schoolPageLink && (
              <a href={school.schoolPageLink} target="_blank" rel="noopener noreferrer" onClick={() => analyticsService.trackOutboundLink(school.schoolPageLink!, 'website')} style={{ fontSize: '11px', color: 'var(--text-tertiary)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.5em' }}>
                <i className="fas fa-link" style={{ fontSize: '11px', opacity: 0.7 }}></i>
                <span>School Website</span>
              </a>
            )}
            {school.driveLink && (
              <a href={school.driveLink} target="_blank" rel="noopener noreferrer" onClick={() => analyticsService.trackOutboundLink(school.driveLink!, 'pdf')} style={{ fontSize: '11px', color: 'var(--text-tertiary)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.5em', marginLeft: 'auto' }}>
                <i className="fas fa-folder-open" style={{ fontSize: '11px', opacity: 0.7 }}></i>
                <span>School PDFs</span>
              </a>
            )}
          </div>
        )}
        */}


      </div>
      {/*--------------------------------
         End: Tooltip Root Container
      ----------------------------------*/}
    </div>
  );
};
