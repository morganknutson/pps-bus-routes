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
    iconAnchor: [anchorX, anchorY],
    popupAnchor: [0, -totalSize],
  });
}

// Helper to calculate dimensions and offsets for the numbered icon
// This is used by MapView to correctly position the tooltip
export function getNumberedIconDimensions(number: number, time?: string, isSelected?: boolean) {
  const hasTime = time && time.trim().length > 0;
  const pillHeight = isSelected ? 32 : 26;
  
  // Mirror calculation logic from createNumberedIcon
  const numberWidth = String(number).length * (isSelected ? 11 : 8);
  const isSingleDigit = String(number).length === 1;
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
  
  const totalWidth = circleRightEdge + (hasTime ? circleToTimeGap + estimatedTimeWidth + timeRightPadding : 0) + horizontalPadding;
  const anchorX = numberCenterX;
  const anchorY = pillHeight / 2;

  return {
    totalWidth,
    pillHeight,
    anchorX,
    anchorY,
    // Horizontal shift to center tooltip on the whole pill instead of the anchor (circle)
    centerShiftX: (totalWidth / 2) - anchorX,
    // Vertical shift to position tooltip 20px below the bottom edge of the pill
    bottomGapY: (pillHeight / 2) + 20
  };
}

// Create numbered marker icons with time
export function createNumberedIcon(number: number, routeColor: string, time?: string, isSelected?: boolean, editingMode?: boolean, uniqueId?: string): L.DivIcon {
  const hasTime = time && time.trim().length > 0;
  const pillHeight = isSelected ? 32 : 26;
  const fontSize = isSelected ? '13px' : '11px';
  const timeFontSize = isSelected ? '11px' : '10px';
  const backgroundColor = routeColor;
  const opacity = isSelected ? '1' : '1';
  const horizontalPadding = hasTime ? (isSelected ? 10 : 8) : (isSelected ? 8 : 6);
  const gap = 6;
  const circleToTimeGap = 8;
  
  const numberWidth = String(number).length * (isSelected ? 11 : 8);
  const isSingleDigit = String(number).length === 1;
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
  const estimatedTimeWidth = hasTime ? Math.max(25, time.length * 5.5) : 0;
  const timeRightPadding = 6;
  const totalWidth = circleRightEdge + (hasTime ? circleToTimeGap + estimatedTimeWidth + timeRightPadding : 0) + horizontalPadding;
  
  const anchorX = numberCenterX;
  const anchorY = pillHeight / 2;
  
  const baseId = uniqueId || `stop-${number}`;
  const classId = baseId.replace(/[^a-zA-Z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  
  // Wrapper size buffer for shadow and animation
  const buffer = 30;
  
  return L.divIcon({
    className: 'numbered-marker',
    html: `
      <style>
        .numbered-marker-wrapper-${classId} {
          width: ${totalWidth + buffer}px;
          height: ${pillHeight + buffer}px;
          position: relative;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          /* Use filter: drop-shadow so the shadow respects the transparent lens hole */
          filter: drop-shadow(0 1px 1px rgba(0,0,0,0.5));
          transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), filter 0.2s ease-out;
          will-change: transform, filter;
        }
        .numbered-marker-wrapper-${classId}:hover,
        .numbered-marker-wrapper-${classId}.active-pin {
          transform: scale(1.05) translateY(-2px);
          filter: drop-shadow(0 2px 3px rgba(0,0,0,0.4));
        }
        /* When marker is being dragged, show closed hand cursor */
        .leaflet-marker-dragging .numbered-marker-wrapper-${classId} {
          cursor: grabbing !important;
          transform: scale(1.05) translateY(-2px);
        }
        .numbered-marker-pill-${classId} {
          transition: border-color 0.2s ease-out;
          width: ${totalWidth}px;
          height: ${pillHeight}px;
          position: relative;
          display: flex;
          align-items: center;
          justify-content: flex-start;
          border: 2px solid white;
          border-radius: ${pillHeight}px;
          padding: 0 ${horizontalPadding}px 0 0;
          box-sizing: border-box;
          /* Create a permanent 'window' hole in the background */
          background: radial-gradient(
            ellipse ${circleWidth / 2}px ${circleHeight / 2}px at ${numberCenterX}px 50%,
            transparent 99%,
            ${backgroundColor} 100%
          );
        }
        .numbered-marker-wrapper-${classId}:hover .numbered-marker-pill-${classId},
        .numbered-marker-wrapper-${classId}.active-pin .numbered-marker-pill-${classId} {
          border-color: white !important;
        }
        .numbered-marker-grey-circle-${classId} {
          position: absolute;
          left: ${numberCenterX}px;
          width: ${circleWidth + 1}px;
          height: ${circleHeight + 1}px;
          border-radius: ${circleHeight}px;
          background-color: white; /* Fully opaque white in resting state */
          pointer-events: none;
          transform: translate(-50%, -50%);
          top: 50%;
          box-sizing: border-box;
          transition: background-color 0.2s ease-out, transform 0.2s ease-out;
          z-index: 0;
          opacity: 1;
        }
        .numbered-marker-wrapper-${classId}:hover .numbered-marker-grey-circle-${classId},
        .numbered-marker-wrapper-${classId}.active-pin .numbered-marker-grey-circle-${classId} {
          /* 35% white lens effect for better visibility while still transparent */
          background-color: rgba(255, 255, 255, 0.35);
          transform: translate(-50%, -50%) scale(0.95);
        }
        @keyframes pinpointPop {
          0% { transform: translate(-50%, -50%) scale(0); }
          70% { transform: translate(-50%, -50%) scale(1.2); }
          100% { transform: translate(-50%, -50%) scale(1); }
        }
        .numbered-marker-dot-${classId} {
          position: absolute;
          left: ${numberCenterX}px;
          top: 50%;
          width: 6px;
          height: 6px;
          background-color: ${backgroundColor};
          border-radius: 50%;
          transform: translate(-50%, -50%) scale(0);
          z-index: 2;
          pointer-events: none;
          box-shadow: 0 1px 1px rgba(0,0,0,0.6), 0 0 2px rgba(255,255,255,0.8);
          will-change: transform;
        }
        .numbered-marker-wrapper-${classId}:hover .numbered-marker-dot-${classId},
        .numbered-marker-wrapper-${classId}.active-pin .numbered-marker-dot-${classId} {
          animation: pinpointPop 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
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
        .numbered-marker-wrapper-${classId}:hover .numbered-marker-time-${classId},
        .numbered-marker-wrapper-${classId}.active-pin .numbered-marker-time-${classId} {
          opacity: 0.9;
          transform: translateY(-50%) translateX(2px);
        }
      </style>
      <div class="numbered-marker-wrapper-${classId} ${isSelected ? 'active-pin' : ''}">
        <div class="numbered-marker-pill-${classId}" style="opacity: ${opacity};">
          <div class="numbered-marker-grey-circle-${classId}"></div>
          <div class="numbered-marker-dot-${classId}"></div>
          <span class="numbered-marker-number-${classId}">${number}</span>
          ${hasTime ? `<span class="numbered-marker-time-${classId}">${time}</span>` : ''}
        </div>
      </div>
    `,
    iconSize: [totalWidth + buffer, pillHeight + buffer],
    iconAnchor: [anchorX + buffer / 2, anchorY + buffer / 2],
    popupAnchor: [0, -pillHeight],
  });
}
