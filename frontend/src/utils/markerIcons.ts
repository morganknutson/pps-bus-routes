import L from 'leaflet';
import { createSchoolIconHTML } from './fontAwesomeIcons';

// Create school icon (simple circle with school symbol, no hover state)
export function createSchoolIcon(routeColor: string, time?: string): L.DivIcon {
  const circleSize = 28; // Size of the circle
  const iconSize = 12; // Size of the school icon inside
  
  const anchorX = circleSize / 2;
  const anchorY = circleSize / 2;
  
  // School icon using Font Awesome
  const schoolIconSVG = createSchoolIconHTML('white', iconSize);
  
  return L.divIcon({
    className: 'school-marker',
    html: `
      <div style="
        width: ${circleSize}px;
        height: ${circleSize}px;
        border-radius: 50%;
        background-color: ${routeColor};
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        pointer-events: none;
      ">
        ${schoolIconSVG}
      </div>
    `,
    iconSize: [circleSize, circleSize],
    iconAnchor: [anchorX, anchorY],
    popupAnchor: [0, -circleSize],
  });
}

// Create numbered marker icons with time
export function createNumberedIcon(number: number, routeColor: string, time?: string, isSelected?: boolean, editingMode?: boolean): L.DivIcon {
  const hasTime = time && time.trim().length > 0;
  const pillHeight = isSelected ? 32 : 26;
  const fontSize = isSelected ? '13px' : '11px';
  const timeFontSize = isSelected ? '11px' : '10px';
  // Use route color for both selected and unselected states to maintain consistency
  const backgroundColor = routeColor;
  const opacity = isSelected ? '1' : '0.6';
  // Normal padding on both sides
  const horizontalPadding = hasTime ? (isSelected ? 10 : 8) : (isSelected ? 8 : 6);
  const gap = 6; // Gap between number and time
  const circleToTimeGap = 8; // Additional gap to prevent time from overlapping circle
  
  // Calculate number width first
  // Use better estimate for selected state to account for larger font size
  const numberWidth = String(number).length * (isSelected ? 11 : 8);
  
  // Circle size - height matches pill height, width adjusts to number width
  // Single digits should be circles, multi-digit can be pill-shaped
  // Calculate padding to ensure single digits become perfect circles (width = height)
  // Scale minimum padding proportionally with pill height (about 23% of height)
  const minPadding = Math.round(pillHeight * 0.23); // ~6px for 26px, ~7px for 32px
  const numberPadding = Math.max(minPadding, (pillHeight - numberWidth) / 2);
  const circleHeight = pillHeight; // Circle height matches pill height
  // Ensure circle is at least as wide as it is tall for single digits (perfect circle)
  const circleWidth = Math.max(pillHeight, numberWidth + numberPadding * 2);
  const smallCircleSize = 6; // Final small circle size (slightly smaller)
  
  // Calculate position - position circle so its left edge is at the pill's left edge
  // This prevents white space for multi-digit numbers
  const circleLeftEdge = 0; // Circle starts at the left edge of the pill
  const numberCenterX = circleLeftEdge + circleWidth / 2;
  
  // Calculate total width based on content
  // Circle extends from circleLeftEdge to circleLeftEdge + circleWidth
  // Then we need space for time and padding
  const estimatedTimeWidth = hasTime ? Math.max(25, time.length * 5.5) : 0;
  const timeRightPadding = 6; // Additional padding on right of time to keep it contained
  const circleRightEdge = circleLeftEdge + circleWidth;
  const totalWidth = circleRightEdge + (hasTime ? circleToTimeGap + estimatedTimeWidth + timeRightPadding : 0) + horizontalPadding;
  
  // No expansion needed - just hide number on hover
  
  // Anchor at center of the number (both horizontally and vertically)
  // The number is vertically centered in the pill, so anchor at pillHeight / 2
  // Pill is shifted right, so anchor X is at number center, not pill center
  const anchorX = numberCenterX;
  const anchorY = pillHeight / 2; // Anchor at vertical center of pill where number is
  
  // Use simple class names like the original working version
  // Each marker instance gets its own unique number, so conflicts are unlikely
  const classId = number;
  
  return L.divIcon({
    className: 'numbered-marker',
    html: `
      <style>
        .numbered-marker-wrapper-${classId} {
          width: ${totalWidth}px;
          height: ${pillHeight}px;
          position: relative;
        }
        /* When marker is being dragged, show closed hand cursor */
        .leaflet-marker-dragging .numbered-marker-wrapper-${classId} .numbered-marker-pill-${classId} {
          cursor: grabbing !important;
        }
        .numbered-marker-pill-${classId} {
          transition: background-color 0.125s ease-out, border-color 0.125s ease-out;
          width: ${totalWidth}px;
        }
        .numbered-marker-wrapper-${classId}:hover .numbered-marker-pill-${classId} {
          background-color: rgba(255, 255, 255, 0.4) !important;
          border-color: ${backgroundColor} !important;
        }
        .numbered-marker-grey-circle-${classId} {
          position: absolute;
          left: ${numberCenterX}px;
          width: ${circleWidth}px;
          height: ${circleHeight}px;
          border-radius: 50%;
          background-color: ${backgroundColor};
          pointer-events: none;
          transform: translate(-50%, -50%);
          top: 50%;
          transition: left 0.125s ease-out, width 0.125s ease-out, height 0.125s ease-out, background-color 0.125s ease-out, border-radius 0.125s ease-out;
          z-index: 0;
        }
        .numbered-marker-wrapper-${classId}:hover .numbered-marker-grey-circle-${classId} {
          left: ${numberCenterX}px;
          width: ${smallCircleSize}px;
          height: ${smallCircleSize}px;
          border-radius: 50%;
          background-color: ${backgroundColor};
        }
        .numbered-marker-number-${classId} {
          position: absolute;
          left: ${numberCenterX}px;
          top: 50%;
          transform: translate(-50%, -50%);
          transition: opacity 0.125s ease-out;
          z-index: 1;
          pointer-events: none;
        }
        .numbered-marker-wrapper-${classId}:hover .numbered-marker-number-${classId} {
          opacity: 0;
        }
        .numbered-marker-time-${classId} {
          position: absolute;
          left: ${circleRightEdge + circleToTimeGap}px;
          top: 50%;
          transform: translateY(-50%);
          z-index: 1;
          pointer-events: none;
        }
      </style>
      <div class="numbered-marker-wrapper-${classId}">
        <div class="numbered-marker-pill-${classId}" style="
          position: relative;
          display: flex;
          align-items: center;
          justify-content: flex-start;
          background-color: rgba(255, 255, 255, 0.8);
          border: 2px solid ${backgroundColor};
          border-radius: ${pillHeight}px;
          padding: 0 ${horizontalPadding}px 0 0;
          height: ${pillHeight}px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.3);
          opacity: ${opacity};
          gap: ${hasTime ? gap : 0}px;
          cursor: ${editingMode ? 'pointer' : (isSelected ? 'grab' : 'pointer')};
        ">
          <div class="numbered-marker-grey-circle-${classId}"></div>
          <span class="numbered-marker-number-${classId}" style="
            color: white;
            font-weight: bold;
            font-size: ${fontSize};
            line-height: 1;
            white-space: nowrap;
          ">${number}</span>
          ${hasTime ? `<span class="numbered-marker-time-${classId}" style="
            font-size: ${timeFontSize};
            font-weight: 600;
            color: ${backgroundColor};
            opacity: 0.9;
            white-space: nowrap;
            line-height: 1;
          ">${time}</span>` : ''}
        </div>
      </div>
    `,
    iconSize: [totalWidth, pillHeight],
    iconAnchor: [anchorX, anchorY],
    popupAnchor: [0, -pillHeight],
  });
}

