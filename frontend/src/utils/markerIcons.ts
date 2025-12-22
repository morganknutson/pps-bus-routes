import L from 'leaflet';
import { createSchoolIconHTML } from './fontAwesomeIcons';

// Create school icon (simple circle with school symbol, no hover state)
export function createSchoolIcon(routeColor: string, time?: string): L.DivIcon {
  const borderWidth = 2; // White border width
  const circleSize = 22; // Size of the circle (content area)
  const iconSize = 10; // Size of the school icon inside
  const totalSize = circleSize + (borderWidth * 2); // Total size including border
  
  const anchorX = totalSize / 2;
  const anchorY = totalSize / 2;
  
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
        border: ${borderWidth}px solid white;
        box-sizing: border-box;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        pointer-events: none;
      ">
        ${schoolIconSVG}
      </div>
    `,
    iconSize: [totalSize, totalSize],
    iconAnchor: [anchorX, anchorY - 3],
    popupAnchor: [0, -totalSize],
  });
}

// Helper to calculate dimensions and offsets for the numbered icon
// This is used by MapView to correctly position the tooltip
export function getNumberedIconDimensions(number: number, time?: string, isSelected?: boolean) {
  const hasTime = time && time.trim().length > 0;
  const pillHeight = isSelected ? 34 : 26;
  
  // Mirror calculation logic from createNumberedIcon
  const numberWidth = String(number).length * (isSelected ? 11 : 8);
  const borderWidth = 2;
  const circleHeight = Math.round(pillHeight - (borderWidth * 2));
  
  const minPadding = Math.round(pillHeight * 0.23);
  const numberPadding = Math.max(minPadding, (pillHeight - numberWidth) / 2);
  
  let circleWidth: number;
  if (numberWidth <= circleHeight) {
    // For 1 and 2 digit numbers, keep it as a perfect circle if it fits
    circleWidth = Math.round(circleHeight);
  } else {
    // For 3+ digit numbers, expand into a stadium shape
    circleWidth = numberWidth + numberPadding * 2 + 1;
  }
  
  const circleLeftEdge = 0;
  const numberCenterX = circleLeftEdge + circleWidth / 2;
  const circleRightEdge = circleLeftEdge + circleWidth;
  const circleToTimeGap = 8;
  const horizontalPadding = hasTime ? (isSelected ? 10 : 8) : (isSelected ? 8 : 6);
  const estimatedTimeWidth = hasTime ? Math.max(25, time!.length * 5.5) : 0;
  const timeRightPadding = 6;
  
  // IF SELECTED: Force circular shape (totalWidth = pillHeight) and no time
  const totalWidth = isSelected 
    ? pillHeight 
    : (circleRightEdge + (hasTime ? circleToTimeGap + estimatedTimeWidth + timeRightPadding : 0) + horizontalPadding);
  
  const anchorX = isSelected ? (pillHeight / 2) : numberCenterX;
  const anchorY = (pillHeight / 2);

  return {
    totalWidth,
    pillHeight,
    anchorX,
    anchorY,
    // Horizontal shift to center tooltip on the whole pill instead of the anchor (circle)
    centerShiftX: isSelected ? 0 : (totalWidth / 2) - anchorX,
    // Vertical shift to position tooltip 20px below the bottom edge of the pill
    bottomGapY: (pillHeight / 2) + 20
  };
}

// Create numbered marker icons with time
export function createNumberedIcon(number: number, routeColor: string, time?: string, isSelected?: boolean, editingMode?: boolean, uniqueId?: string): L.DivIcon {
  const hasTimeInput = time && time.trim().length > 0;
  const dims = getNumberedIconDimensions(number, time, isSelected);
  const { totalWidth, pillHeight, anchorX, anchorY } = dims;
  
  // For the style logic, we need some internal dimensions
  const numberWidth = String(number).length * (isSelected ? 11 : 8);
  const borderWidth = 2;
  const circleHeight = Math.round(pillHeight - (borderWidth * 2));
  
  const minPadding = Math.round(pillHeight * 0.23);
  const numberPadding = Math.max(minPadding, (pillHeight - numberWidth) / 2);
  
  let circleWidth: number;
  if (numberWidth <= circleHeight) {
    circleWidth = Math.round(circleHeight);
  } else {
    circleWidth = numberWidth + numberPadding * 2 + 1;
  }
  
  const circleLeftEdge = 0;
  // If selected, center in the circle, otherwise use standard anchor
  const numberCenterX = isSelected ? (totalWidth / 2) : (circleLeftEdge + circleWidth / 2);
  const circleRightEdge = circleLeftEdge + circleWidth;
  const circleToTimeGap = 8;
  
  const fontSize = isSelected ? '13px' : '11px';
  const timeFontSize = isSelected ? '11px' : '10px';
  const backgroundColor = routeColor;
  const opacity = isSelected ? '1' : '1';
  const horizontalPadding = hasTimeInput ? (isSelected ? 10 : 8) : (isSelected ? 8 : 6);
  
  const baseId = uniqueId || `stop-${number}`;
  const classId = baseId.replace(/[^a-zA-Z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  
  // Wrapper size buffer for shadow and animation
  // Reduce buffer significantly to make hit areas tighter
  const buffer = 4; 
  
  return L.divIcon({
    className: 'numbered-marker',
    html: `
      <style>
        @keyframes selectedPop {
          0% { transform: scale(1); }
          50% { transform: scale(1.15); }
          100% { transform: scale(1.1); }
        }
        @keyframes selectedPulse {
          0% { box-shadow: 0 0 0 0 ${backgroundColor}66; }
          70% { box-shadow: 0 0 0 15px ${backgroundColor}00; }
          100% { box-shadow: 0 0 0 0 ${backgroundColor}00; }
        }
        .numbered-marker-wrapper-${classId} {
          width: ${totalWidth}px;
          height: ${pillHeight}px;
          position: relative;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          filter: drop-shadow(0 1px 1px rgba(0,0,0,0.5));
          transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), filter 0.2s ease-out;
          will-change: transform, filter;
        }
        .numbered-marker-wrapper-${classId}:hover {
          transform: scale(1.05) translateY(-2px);
          filter: drop-shadow(0 2px 3px rgba(0,0,0,0.4));
          z-index: 1001; /* Lift on hover for better interaction */
        }
        .numbered-marker-wrapper-${classId}.active-pin {
          animation: selectedPop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
          filter: drop-shadow(0 3px 6px rgba(0,0,0,0.4));
          z-index: 1000;
        }
        /* When marker is being dragged, show closed hand cursor */
        .leaflet-marker-dragging .numbered-marker-wrapper-${classId} {
          cursor: grabbing !important;
          transform: scale(1.05) translateY(-2px);
        }
        .numbered-marker-pill-${classId} {
          transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
          width: ${totalWidth}px;
          height: ${pillHeight}px;
          position: relative;
          display: flex;
          align-items: center;
          justify-content: ${isSelected ? 'center' : 'flex-start'};
          border: 2px solid white;
          border-radius: ${pillHeight}px;
          padding: 0;
          box-sizing: border-box;
          background: ${isSelected ? 'var(--active-marker-lens-bg, transparent) !important' : `radial-gradient(
            ellipse ${circleWidth / 2}px ${circleHeight / 2}px at ${numberCenterX}px 50%,
            transparent 99%,
            ${backgroundColor} 100%
          )`};
          ${isSelected ? `animation: selectedPulse 2s infinite;` : ''}
        }
        .numbered-marker-wrapper-${classId}:hover .numbered-marker-pill-${classId} {
          border-color: white !important;
        }
        .numbered-marker-wrapper-${classId}.active-pin .numbered-marker-pill-${classId} {
          border-color: white !important;
        }
        .numbered-marker-lens-${classId} {
          position: absolute;
          left: ${numberCenterX}px;
          top: 50%;
          width: ${circleWidth + 1}px;
          height: ${circleHeight + 1}px;
          border-radius: 50%;
          background-color: white;
          pointer-events: none;
          transform: translate(-50%, -50%);
          z-index: 0;
          transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
          box-shadow: 0 0 2px rgba(0,0,0,0.1);
          /* Ensure it's perfectly circular and centered */
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .numbered-marker-wrapper-${classId}:hover .numbered-marker-lens-${classId} {
          left: ${numberCenterX}px;
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background-color: white;
          box-shadow: 0 1px 1px rgba(0,0,0,0.6), 0 0 2px rgba(255,255,255,0.8);
        }
        .numbered-marker-wrapper-${classId}.active-pin .numbered-marker-lens-${classId} {
          left: 50%;
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background-color: white;
          box-shadow: 0 1px 1px rgba(0,0,0,0.6), 0 0 2px rgba(255,255,255,0.8);
        }
        .numbered-marker-number-${classId} {
          position: absolute;
          left: ${numberCenterX - 1}px; /* Optical alignment */
          top: 50%;
          transform: translate(-50%, -50%);
          transition: opacity 0.2s ease-out, transform 0.2s ease-out;
          z-index: 1;
          pointer-events: none;
          color: ${backgroundColor};
          font-weight: bold;
          font-size: ${fontSize};
          line-height: 1;
          white-space: nowrap;
        }
        .numbered-marker-wrapper-${classId}:hover .numbered-marker-number-${classId},
        .numbered-marker-wrapper-${classId}.active-pin .numbered-marker-number-${classId} {
          opacity: 0;
          transform: translate(-50%, -50%) scale(0.8);
        }
        .numbered-marker-time-${classId} {
          position: absolute;
          left: ${circleRightEdge + circleToTimeGap}px;
          top: 50%;
          transform: translateY(-50%);
          z-index: 1;
          pointer-events: none;
          transition: opacity 0.2s ease-out, transform 0.2s ease-out;
          font-size: ${timeFontSize};
          font-weight: 600;
          color: white;
          white-space: nowrap;
          line-height: 1;
          text-shadow: 0px 1px 1px rgba(0, 0, 0, 0.2);
        }
        .numbered-marker-wrapper-${classId}:hover .numbered-marker-time-${classId} {
          opacity: 0.9;
          transform: translateY(-50%) translateX(2px);
        }
        .numbered-marker-wrapper-${classId}.active-pin .numbered-marker-time-${classId} {
          opacity: 0;
        }
      </style>
      <div class="numbered-marker-wrapper-${classId} ${isSelected ? 'active-pin' : ''}">
        <div class="numbered-marker-pill-${classId}" style="opacity: ${opacity};">
          <div class="numbered-marker-lens-${classId}"></div>
          <span class="numbered-marker-number-${classId}">${number}</span>
          ${hasTimeInput && !isSelected ? `<span class="numbered-marker-time-${classId}">${time}</span>` : ''}
        </div>
      </div>
    `,
    iconSize: [totalWidth + buffer, pillHeight + buffer],
    iconAnchor: [anchorX + buffer / 2, (anchorY + buffer / 2)],
    popupAnchor: [0, -pillHeight],
  });
}
