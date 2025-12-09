import L from 'leaflet';

/**
 * Creates a Font Awesome icon as HTML string for use in Leaflet divIcons
 */
export function createFontAwesomeIcon(iconClass: string, color: string = '#333', size: number = 16): string {
  // Font Awesome 6 uses fa-solid prefix, but we'll use fas for compatibility
  // Icon class should include 'fa-' prefix (e.g., 'fa-location-pin')
  return `<i class="fas ${iconClass}" style="color: ${color}; font-size: ${size}px;"></i>`;
}

/**
 * Creates a default Leaflet marker using Font Awesome map marker icon
 */
export function createDefaultMarkerIcon(): L.DivIcon {
  const iconSize = 25;
  const iconHtml = createFontAwesomeIcon('fa-location-pin', '#3388ff', 25);
  
  return L.divIcon({
    className: 'fontawesome-marker',
    html: `
      <div style="
        display: flex;
        align-items: center;
        justify-content: center;
        width: ${iconSize}px;
        height: ${iconSize}px;
        filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));
      ">
        ${iconHtml}
      </div>
    `,
    iconSize: [iconSize, iconSize],
    iconAnchor: [iconSize / 2, iconSize],
    popupAnchor: [0, -iconSize],
  });
}

/**
 * Creates a home marker icon using Font Awesome home icon in a circle
 */
export function createHomeIcon(): L.DivIcon {
  const circleSize = 28;
  const iconSize = 12; // Smaller icon within the circle
  const backgroundColor = '#ff0000'; // Red
  const iconHtml = createFontAwesomeIcon('fa-house', 'white', iconSize);
  
  return L.divIcon({
    className: 'fontawesome-home-marker',
    html: `
      <div style="
        position: relative;
        width: ${circleSize}px;
        height: ${circleSize}px;
        border-radius: 50%;
        background-color: ${backgroundColor};
        border: 2px solid white;
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
      ">
        <div style="
          display: flex;
          align-items: center;
          justify-content: center;
        ">
          ${iconHtml}
        </div>
      </div>
    `,
    iconSize: [circleSize, circleSize],
    iconAnchor: [circleSize / 2, circleSize / 2],
    popupAnchor: [0, -circleSize],
  });
}

/**
 * Creates a school icon HTML string using Font Awesome graduation cap icon
 */
export function createSchoolIconHTML(color: string = 'white', size: number = 12): string {
  return createFontAwesomeIcon('fa-graduation-cap', color, size);
}

