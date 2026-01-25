import L from 'leaflet';
import { createSchoolIconHTML } from './fontAwesomeIcons';

// Infer school type(s) from name - returns array to support hybrid schools
export function getSchoolTypes(schoolName: string): ('Elementary School' | 'Middle School' | 'High School' | 'K-8')[] {
  const name = schoolName.toLowerCase();
  const types: ('Elementary School' | 'Middle School' | 'High School' | 'K-8')[] = [];
  
  // Hybrid schools - K-8 schools that serve multiple grade levels (Elementary + Middle)
  // Check these FIRST before other type checks
  const hybridSchools = [
    'access', 
    // K-8 schools
    'astor', 'beverly cleary', 'bridger', 'cesar chavez', 'césar chávez',
    'faubion', 'laurelhurst', 'skyline', 'sunnyside', 'vernon'
  ];
  
  if (hybridSchools.some(key => name.includes(key))) {
    return ['K-8'];
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
    'lane', 'gray', 'kelly', 'kellogg', 'mt tabor', 'mt. tabor', 'roseway heights',
    'tubman', 'harriet tubman', 'jackson', 'ockley green', 'sellwood'
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

/**
 * Get the display name for a school, mapping shortened names to full official names
 * for the frontend only, while keeping the underlying data/IDs the same.
 * 
 * Note: We strip school types (Elementary, Middle, High School) from the name
 * because they are displayed as a separate tag in the UI.
 */
export function getSchoolDisplayName(name: string): string {
  const mapping: Record<string, string> = {
    'Lee': 'Jason Lee',
    'Boise-Eliot': 'Boise-Eliot/Humboldt',
    'Dr Martin Luther King': 'Dr. Martin Luther King Jr.',
    'Abernethy': 'Abernethy',
    'Ainsworth': 'Ainsworth',
    'Alameda': 'Alameda',
    'Arleta': 'Arleta',
    'Astor': 'Astor',
    'Atkinson': 'Atkinson',
    'Beach': 'Beach',
    'Bridger': 'Bridger',
    'Bridlemile': 'Bridlemile',
    'Buckman': 'Buckman Arts Focus',
    'Capitol': 'Capitol Hill',
    'Cesar Chavez': 'César Chávez',
    'Chapman': 'Chapman',
    'Chief Joseph': 'Chief Joseph',
    'Clark': 'Clark',
    'Creston': 'Creston',
    'Duniway': 'Duniway',
    'Faubion': 'Faubion',
    'Forest Park': 'Forest Park',
    'Glencoe': 'Glencoe',
    'Grout': 'Grout',
    'Hayhurst': 'Hayhurst',
    'Irvington': 'Irvington',
    'James John': 'James John',
    'Kelly': 'Kelly',
    'Lent': 'Lent',
    'Lewis': 'Lewis',
    'Llewellyn': 'Llewellyn',
    'Maplewood': 'Maplewood',
    'Markham': 'Markham',
    'Marysville': 'Marysville',
    'Peninsula': 'Peninsula',
    'Richmond': 'Richmond',
    'Rieke': 'Rieke',
    'Rigler': 'Rigler',
    'Rosa Parks': 'Rosa Parks',
    'Rose City Park': 'Rose City Park',
    'Sabin': 'Sabin',
    'Scott': 'Scott',
    'Sitton': 'Sitton',
    'Stephenson': 'Stephenson',
    'Vernon': 'Vernon',
    'Vestal': 'Vestal',
    'Whitman': 'Whitman',
    'Woodlawn': 'Woodlawn',
    'Woodmere': 'Woodmere',
    'Woodstock': 'Woodstock',
    'Gray': 'Robert Gray',
    'Hosford': 'Hosford',
    'Lane': 'Lane',
    'Mt Tabor': 'Mt. Tabor',
    'Sellwood': 'Sellwood',
    'Tubman': 'Harriet Tubman',
    'Benson': 'Benson Polytechnic',
    'Franklin': 'Franklin',
    'Lincoln': 'Lincoln',
    'Leodis V. McDaniel': 'McDaniel',
    'Ida B. Wells-Barnett High School': 'Ida B. Wells',
  };

  const displayName = mapping[name] || name;
  
  // Strip common school type suffixes if they exist
  // We match " Elementary", " Middle School", " High School" etc. at the end of the string
  return displayName.replace(/( Elementary( School)?| Middle School| High School| K-8( School)?| PK-8( School)?)$/i, '');
}

export function getSchoolColor(schoolTypes: ('Elementary School' | 'Middle School' | 'High School' | 'K-8')[]): string {
  if (schoolTypes.includes('K-8')) {
    return 'var(--color-k8)'; // Purple for K-8 schools (brighter in dark mode)
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
        return '#FFFFFF'; // Default teal
    }
  }
  return '#FFFFFF'; // Default teal
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
