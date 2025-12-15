import L from 'leaflet';
import { createSchoolIconHTML } from './fontAwesomeIcons';

// Infer school type(s) from name - returns array to support hybrid schools
export function getSchoolTypes(schoolName: string): ('Elementary School' | 'Middle School' | 'High School' | 'Hybrid')[] {
  const name = schoolName.toLowerCase();
  const types: ('Elementary School' | 'Middle School' | 'High School' | 'Hybrid')[] = [];
  
  // Hybrid schools - schools that serve multiple grade levels
  // Check these FIRST before other type checks
  const hybridSchools = ['access'];
  
  if (hybridSchools.some(key => name.includes(key))) {
    return ['Hybrid'];
  }
  
  // Check for explicit type in name
  if (name.includes('elementary')) types.push('Elementary School');
  if (name.includes('middle')) types.push('Middle School');
  if (name.includes('high')) types.push('High School');
  
  // Known high schools in Portland
  const highSchools = [
    'lincoln', 'franklin', 'benson', 'grant', 'cleveland', 'jefferson', 
    'roosevelt', 'wilson', 'madison', 'marshall', 'da vinci', 'davinci'
  ];
  if (highSchools.some(hs => name.includes(hs)) && !types.includes('High School')) {
    types.push('High School');
  }
  
  // Known middle schools in Portland
  const middleSchools = [
    'beaumont', 'hosford', 'west sylvan', 'george', 'harrison park', 
    'lane', 'gray', 'kelly', 'kellogg', 'mt tabor', 'mt. tabor', 'roseway heights'
  ];
  if (middleSchools.some(ms => name.includes(ms)) && !types.includes('Middle School')) {
    types.push('Middle School');
  }
  
  // Default to elementary if no types found
  if (types.length === 0) {
    types.push('Elementary School');
  }
  
  return types;
}

export function getSchoolColor(schoolTypes: ('Elementary School' | 'Middle School' | 'High School' | 'Hybrid')[]): string {
  if (schoolTypes.includes('Hybrid')) {
    return '#9C27B0'; // Purple for hybrid schools
  }
  if (schoolTypes.length === 1) {
    switch (schoolTypes[0]) {
      case 'Elementary School':
        return '#2196F3'; // Blue
      case 'Middle School':
        return '#4CAF50'; // Green
      case 'High School':
        return '#FF9800'; // Orange
      default:
        return '#4ECDC4'; // Default teal
    }
  }
  return '#4ECDC4'; // Default teal
}

export function createSchoolIcon(color: string): L.DivIcon {
  const circleSize = 28;
  const iconSize = 12;
  
  // School icon using Font Awesome
  const schoolIconSVG = createSchoolIconHTML('white', iconSize);
  
  return L.divIcon({
    className: 'school-marker',
    html: `
      <div style="
        position: relative;
        width: ${circleSize}px;
        height: ${circleSize}px;
        border-radius: 50%;
        background-color: ${color};
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
          ${schoolIconSVG}
        </div>
      </div>
    `,
    iconSize: [circleSize, circleSize],
    iconAnchor: [circleSize / 2, circleSize / 2],
    popupAnchor: [0, -circleSize],
  });
}

