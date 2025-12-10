import { useState, useEffect, useRef } from 'react';
import { Header } from '../components/Header';
import { Sidebar } from '../components/Sidebar';
import { ExpandableExample } from '../components/ExpandableExample';
import { RouteListBase } from '../components/RouteListBase';
import { SchoolList } from '../components/SchoolList';
import { Route, School, Stop } from '../types';

interface Section {
  id: string;
  title: string;
  subsections?: { id: string; title: string }[];
}

const sections: Section[] = [
  {
    id: 'functionality',
    title: 'Functionality and Interactions',
    subsections: [
      { id: 'understanding-school-routes', title: '1. Understanding School Routes' },
      { id: 'checking-pdfs-drive', title: '2. Checking PDFs in Drive Links' },
      { id: 'processing-pdfs', title: '3. Processing PDFs' },
      { id: 'creating-routes', title: '4. Creating Routes' },
      { id: 'geocoding-stops', title: '5. Geocoding Stops' },
      { id: 'plotting-routes', title: '6. Plotting Routes on Map' },
      { id: 'route-visualization', title: '7. Route Visualization' },
      { id: 'neighborhood-exploration', title: '8. Neighborhood Exploration' },
    ],
  },
  {
    id: 'backend-services',
    title: 'Backend Services',
    subsections: [
      { id: 'geocoding-service', title: '1. GeocodingService' },
      { id: 'drive-service', title: '2. DriveService' },
      { id: 'pdf-parser', title: '3. PdfParser' },
      { id: 'autocomplete-service', title: '4. AutocompleteService' },
      { id: 'neighborhood-service', title: '5. NeighborhoodService' },
      { id: 'street-geometry-service', title: '6. StreetGeometryService' },
      { id: 'places-service', title: '7. PlacesService' },
      { id: 'directions-service', title: '8. DirectionsService' },
      { id: 'scheduler-service', title: '9. SchedulerService' },
    ],
  },
  {
    id: 'frontend-services',
    title: 'Frontend Services',
    subsections: [
      { id: 'api-service', title: '1. API Service' },
      { id: 'local-routes-service', title: '2. Local Routes Service' },
      { id: 'routing-service', title: '3. Routing Service' },
      { id: 'route-cache-service', title: '4. Route Cache Service' },
    ],
  },
  {
    id: 'data-examples',
    title: 'Complete Data Entry Examples',
    subsections: [
      { id: 'processed-route-example', title: 'Processed Route Example' },
      { id: 'school-entry-example', title: 'School Entry Example' },
      { id: 'neighborhood-data-example', title: 'Neighborhood Data Example' },
    ],
  },
  {
    id: 'file-structure',
    title: 'File Structure',
  },
  {
    id: 'coordinate-format',
    title: 'Coordinate Format Notes',
  },
];

// Example data for UI components
const exampleSchool: School = {
  id: 'west-sylvan',
  name: 'West Sylvan',
  address: '1301 SW 25th Ave, Portland, OR 97201',
  coordinates: [-122.6984, 45.5123],
  schoolPageLink: 'https://www.pps.net/westsylvan',
  driveLink: 'https://drive.google.com/drive/folders/1BC03MH02DFuUL6teeq4jkcT2THRGgzxj',
  createdAt: '2024-01-15T10:00:00.000Z',
  schoolTypes: ['Middle School'],
  routeCount: 12,
};

const exampleSchools: School[] = [
  exampleSchool,
  {
    id: 'lincoln',
    name: 'Lincoln High School',
    address: '1600 SW Salmon St, Portland, OR 97205',
    coordinates: [-122.6900, 45.5200],
    schoolPageLink: 'https://www.pps.net/lincoln',
    driveLink: null,
    createdAt: '2024-01-15T10:00:00.000Z',
    schoolTypes: ['High School'],
    routeCount: 8,
  },
];

const exampleStop: Stop = {
  id: 'stop-1',
  address: 'SW Patton Rd & SW Montgomery Dr [NE]',
  coordinates: [-122.6784, 45.5152],
  displayName: 'SW Patton Rd & SW Montgomery Dr, Portland, OR 97201, USA',
  neighborhood: 'Sylvan-Highlands',
  time: '8:36 am',
  direction: 'NE',
};

const exampleRoute: Route = {
  id: 'route-example-1',
  name: '100',
  direction: 'Morning',
  filename: '100SYL-A_effective_082625.pdf',
  stops: [
    exampleStop,
    {
      id: 'stop-2',
      address: '3737 SW Humphrey Blvd [NE]',
      coordinates: [-122.6821, 45.5123],
      displayName: '3737 SW Humphrey Blvd, Portland, OR 97221, USA',
      neighborhood: 'Sylvan-Highlands',
      time: '8:54 am',
      direction: 'NE',
    },
  ],
  color: '#4ECDC4',
  isSelected: true,
  geocodingProgress: {
    total: 2,
    geocoded: 2,
    isGeocoding: false,
  },
};

export function TechPage() {
  const [activeSection, setActiveSection] = useState<string>('');
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const contentContainer = contentRef.current;
    if (!contentContainer) return;

    const handleScroll = () => {
      const scrollPosition = contentContainer.scrollTop + 100;
      
      for (let i = sections.length - 1; i >= 0; i--) {
        const section = sections[i];
        const element = document.getElementById(section.id);
        if (element) {
          const elementTop = element.getBoundingClientRect().top + contentContainer.scrollTop - contentContainer.getBoundingClientRect().top;
          if (elementTop <= scrollPosition) {
            setActiveSection(section.id);
            break;
          }
        }
      }
    };

    contentContainer.addEventListener('scroll', handleScroll);
    handleScroll(); // Initial check
    
    return () => contentContainer.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    const contentContainer = contentRef.current;
    
    if (element && contentContainer) {
      const headerOffset = 80;
      
      // Get positions relative to viewport
      const containerRect = contentContainer.getBoundingClientRect();
      const elementRect = element.getBoundingClientRect();
      
      // Calculate the element's position relative to the container's scroll position
      // elementRect.top is relative to viewport, containerRect.top is container's viewport position
      // We need: (element's viewport position - container's viewport position) + current scroll = element's scroll position
      const scrollTop = elementRect.top - containerRect.top + contentContainer.scrollTop;
      
      // Scroll to position accounting for header offset
      contentContainer.scrollTo({
        top: Math.max(0, scrollTop - headerOffset),
        behavior: 'smooth',
      });
    }
  };

  return (
    <div style={{ 
      height: '100vh', 
      width: '100vw', 
      backgroundColor: 'var(--bg-primary)', 
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden'
    }}>
      <Header />
      <div style={{ 
        display: 'flex', 
        flex: 1, 
        overflow: 'hidden' 
      }}>
        <Sidebar
          header={
            <div>
              <h2 style={{ 
                color: 'var(--text-primary)', 
                fontSize: '18px', 
                fontWeight: 600,
                margin: 0 
              }}>
                Technical Documentation
              </h2>
              <p style={{ 
                color: 'var(--text-secondary)', 
                fontSize: '14px', 
                margin: '8px 0 0 0' 
              }}>
                Services, APIs & Data
              </p>
            </div>
          }
        >
          <div style={{ padding: '12px' }}>
            {sections.map((section) => (
              <div key={section.id} style={{ marginBottom: '16px' }}>
                <div
                  onClick={() => scrollToSection(section.id)}
                  style={{
                    padding: '8px 12px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    backgroundColor: activeSection === section.id 
                      ? 'var(--bg-tertiary)' 
                      : 'transparent',
                    color: activeSection === section.id 
                      ? 'var(--text-primary)' 
                      : 'var(--text-secondary)',
                    fontWeight: activeSection === section.id ? 600 : 500,
                    fontSize: '15px',
                    transition: 'all 0.2s ease',
                    marginBottom: section.subsections ? '4px' : 0,
                  }}
                  onMouseEnter={(e) => {
                    if (activeSection !== section.id) {
                      e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (activeSection !== section.id) {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }
                  }}
                >
                  {section.title}
                </div>
                {section.subsections && (
                  <div style={{ paddingLeft: '12px', marginTop: '4px' }}>
                    {section.subsections.map((subsection) => (
                      <div
                        key={subsection.id}
                        onClick={() => scrollToSection(subsection.id)}
                        style={{
                          padding: '6px 12px',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          color: 'var(--text-secondary)',
                          fontSize: '13px',
                          transition: 'all 0.2s ease',
                          marginBottom: '2px',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)';
                          e.currentTarget.style.color = 'var(--text-primary)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'transparent';
                          e.currentTarget.style.color = 'var(--text-secondary)';
                        }}
                      >
                        {subsection.title}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </Sidebar>

        <div 
          ref={contentRef}
          style={{ 
            flex: 1, 
            overflowY: 'auto', 
            overflowX: 'hidden',
            padding: '20px 40px',
            paddingBottom: '60px'
          }}>
          <h1 style={{ color: 'var(--text-primary)', marginBottom: '30px', fontSize: '32px' }}>
            Technical Documentation
          </h1>

          <section id="functionality" style={{ marginBottom: '40px', scrollMarginTop: '80px' }}>
            <h2 style={{ color: 'var(--text-primary)', marginBottom: '20px', fontSize: '24px' }}>
              Functionality and Interactions
            </h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '30px' }}>
              This section documents the workflow of how the application processes and displays bus routes, 
              from initial setup through final visualization.
            </p>

            <div id="understanding-school-routes" style={{ marginBottom: '40px', scrollMarginTop: '80px' }}>
              <h3 style={{ color: 'var(--text-primary)', marginBottom: '15px', fontSize: '18px' }}>
                1. Understanding School Routes
              </h3>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '15px' }}>
                Schools are the primary organizational unit for bus routes. Each school has:
              </p>
              <ul style={{ color: 'var(--text-secondary)', marginBottom: '15px', paddingLeft: '20px' }}>
                <li>A unique <code>id</code> (e.g., "west-sylvan")</li>
                <li>A Google Drive folder link containing route PDFs</li>
                <li>Metadata including name, address, coordinates, and school types</li>
                <li>Associated processed route files stored in <code>data/schools/{'{schoolId}'}/processed-routes/</code></li>
              </ul>
              <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '15px', borderRadius: '8px', marginBottom: '15px' }}>
                <strong style={{ color: 'var(--text-primary)' }}>Services Involved:</strong>
                <ul style={{ color: 'var(--text-secondary)', marginTop: '10px', paddingLeft: '20px' }}>
                  <li><strong>PlacesService</strong> - Searches for schools using Google Places API</li>
                  <li><strong>Schools API Route</strong> - Manages school data in <code>data/schools.json</code></li>
                </ul>
              </div>
              <ExpandableExample title="Example: School Data Structure">
                <pre style={{ 
                  backgroundColor: '#1e1e1e', 
                  padding: '15px', 
                  borderRadius: '4px', 
                  overflow: 'auto',
                  color: '#d4d4d4',
                  fontSize: '13px',
                  marginBottom: '15px'
                }}>
{`{
  "id": "west-sylvan",
  "name": "West Sylvan",
  "address": "1301 SW 25th Ave, Portland, OR 97201",
  "coordinates": [-122.6984, 45.5123],  // [lng, lat]
  "schoolPageLink": "https://www.pps.net/westsylvan",
  "driveLink": "https://drive.google.com/drive/folders/...",
  "schoolTypes": ["Middle School"],
  "routeCount": 12
}`}
                </pre>
              </ExpandableExample>
              <ExpandableExample title="UI Component: SchoolList">
                <div style={{ 
                  border: '1px solid var(--border-color)', 
                  borderRadius: '4px',
                  maxHeight: '400px',
                  overflow: 'auto',
                  backgroundColor: 'var(--bg-secondary)',
                }}>
                  <SchoolList
                    schools={exampleSchools}
                    selectedSchoolId={exampleSchool.id}
                    onSelectSchool={() => {}}
                  />
                </div>
              </ExpandableExample>
            </div>

            <div id="checking-pdfs-drive" style={{ marginBottom: '40px', scrollMarginTop: '80px' }}>
              <h3 style={{ color: 'var(--text-primary)', marginBottom: '15px', fontSize: '18px' }}>
                2. Checking PDFs in Drive Links
              </h3>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '15px' }}>
                When a school's Drive link is provided, the system checks for PDF files containing route information.
              </p>
              <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '15px', borderRadius: '8px', marginBottom: '15px' }}>
                <strong style={{ color: 'var(--text-primary)' }}>Process:</strong>
                <ol style={{ color: 'var(--text-secondary)', marginTop: '10px', paddingLeft: '20px' }}>
                  <li>Extract folder ID from Google Drive URL</li>
                  <li>Use <strong>DriveService</strong> to list all PDF files in the folder</li>
                  <li>If API key available: Use Google Drive API v3 for reliable access</li>
                  <li>If no API key: Parse public Drive folder HTML to extract file IDs</li>
                  <li>Return list of PDF files with IDs, names, and modification dates</li>
                </ol>
              </div>
              <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '15px', borderRadius: '8px' }}>
                <strong style={{ color: 'var(--text-primary)' }}>Services Involved:</strong>
                <ul style={{ color: 'var(--text-secondary)', marginTop: '10px', paddingLeft: '20px' }}>
                  <li><strong>DriveService</strong> - Handles Google Drive API calls and HTML parsing</li>
                  <li><strong>Drive API Route</strong> - <code>GET /api/drive/folder/{'{folderId}'}</code></li>
                </ul>
              </div>
            </div>

            <div id="processing-pdfs" style={{ marginBottom: '40px', scrollMarginTop: '80px' }}>
              <h3 style={{ color: 'var(--text-primary)', marginBottom: '15px', fontSize: '18px' }}>
                3. Processing PDFs
              </h3>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '15px' }}>
                Each PDF file is downloaded and parsed to extract route information and stop addresses.
              </p>
              <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '15px', borderRadius: '8px', marginBottom: '15px' }}>
                <strong style={{ color: 'var(--text-primary)' }}>Process:</strong>
                <ol style={{ color: 'var(--text-secondary)', marginTop: '10px', paddingLeft: '20px' }}>
                  <li>Download PDF file from Google Drive using <strong>DriveService</strong></li>
                  <li>Save PDF to <code>data/schools/{'{schoolId}'}/pdfs/</code> for archival</li>
                  <li>Extract text content using <code>pdf-parse</code> library</li>
                  <li>Use <strong>PdfParser</strong> to parse route information:
                    <ul style={{ marginTop: '5px', paddingLeft: '20px' }}>
                      <li>Extract route name and direction from filename (e.g., "100SYL-A" → "100", "Morning")</li>
                      <li>Extract anchor name (school loading zone)</li>
                      <li>Parse stop addresses from PDF text using regex patterns</li>
                      <li>Format addresses (expand abbreviations, normalize street names)</li>
                      <li>Filter out loading zones and school stops (handled separately)</li>
                    </ul>
                  </li>
                  <li>Create initial route object with stops (no coordinates yet)</li>
                </ol>
              </div>
              <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '15px', borderRadius: '8px' }}>
                <strong style={{ color: 'var(--text-primary)' }}>Services Involved:</strong>
                <ul style={{ color: 'var(--text-secondary)', marginTop: '10px', paddingLeft: '20px' }}>
                  <li><strong>DriveService</strong> - Downloads PDF files</li>
                  <li><strong>PdfParser</strong> - Extracts and parses route data from PDF text</li>
                  <li><strong>Drive API Route</strong> - <code>POST /api/drive/folder/{'{folderId}'}/parse</code></li>
                </ul>
              </div>
            </div>

            <div id="creating-routes" style={{ marginBottom: '40px', scrollMarginTop: '80px' }}>
              <h3 style={{ color: 'var(--text-primary)', marginBottom: '15px', fontSize: '18px' }}>
                4. Creating Routes
              </h3>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '15px' }}>
                After parsing, route objects are created with metadata and stop information.
              </p>
              <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '15px', borderRadius: '8px', marginBottom: '15px' }}>
                <strong style={{ color: 'var(--text-primary)' }}>Route Structure:</strong>
                <ul style={{ color: 'var(--text-secondary)', marginTop: '10px', paddingLeft: '20px' }}>
                  <li><code>id</code> - Unique identifier (usually file ID from Drive)</li>
                  <li><code>name</code> - Route number (e.g., "100")</li>
                  <li><code>direction</code> - "Morning" or "Afternoon"</li>
                  <li><code>filename</code> - Original PDF filename</li>
                  <li><code>stops</code> - Array of stop objects (addresses, times, directions)</li>
                  <li><code>anchorName</code> - School loading zone name (for matching to schools)</li>
                </ul>
              </div>
              <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '15px', borderRadius: '8px', marginBottom: '15px' }}>
                <strong style={{ color: 'var(--text-primary)' }}>Note:</strong>
                <p style={{ color: 'var(--text-secondary)', marginTop: '10px' }}>
                  At this stage, stops have addresses but no coordinates. Geocoding happens in the next step.
                </p>
              </div>
              <ExpandableExample title="Example: Route Object (Before Geocoding)">
                <pre style={{ 
                  backgroundColor: '#1e1e1e', 
                  padding: '15px', 
                  borderRadius: '4px', 
                  overflow: 'auto',
                  color: '#d4d4d4',
                  fontSize: '13px',
                  marginBottom: '15px'
                }}>
{`{
  "id": "1a2b3c4d5e6f",
  "name": "100",
  "direction": "Morning",
  "filename": "100SYL-A_effective_082625.pdf",
  "stops": [
    {
      "id": "stop-1",
      "address": "SW Patton Rd & SW Montgomery Dr [NE]",
      "time": "8:36 am",
      "direction": "NE",
      "originalLine": "8:36 amSW PATTON RD @ SW MONTGOMERY DR [NE]100SYL-A(2)"
    }
  ],
  "anchorName": "WEST SYLVAN GT LOADING ZONE"
}`}
                </pre>
              </ExpandableExample>
              <ExpandableExample title="UI Component: RouteList (Example Route)">
                <div style={{ 
                  border: '1px solid var(--border-color)', 
                  borderRadius: '4px',
                  maxHeight: '400px',
                  overflow: 'auto',
                  backgroundColor: 'var(--bg-secondary)',
                }}>
                  <div style={{ padding: '0.5rem', height: '100%' }}>
                    <RouteListBase
                      routes={[exampleRoute]}
                      config={{
                        showRouteSelection: true,
                        onRouteSelectionChange: () => {},
                        isRouteSelected: () => true,
                        onStopClick: () => {},
                      }}
                    />
                  </div>
                </div>
                <p style={{ color: 'var(--text-secondary)', marginTop: '15px', fontSize: '13px' }}>
                  <strong>Note:</strong> This shows how a route appears in the RouteList component. The component automatically 
                  displays stops with their addresses, times, and neighborhoods. Clicking stops would normally highlight them on the map.
                </p>
              </ExpandableExample>
            </div>

            <div id="geocoding-stops" style={{ marginBottom: '40px', scrollMarginTop: '80px' }}>
              <h3 style={{ color: 'var(--text-primary)', marginBottom: '15px', fontSize: '18px' }}>
                5. Geocoding Stops
              </h3>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '15px' }}>
                Each stop address is converted to coordinates (latitude/longitude) using geocoding services.
              </p>
              <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '15px', borderRadius: '8px', marginBottom: '15px' }}>
                <strong style={{ color: 'var(--text-primary)' }}>Process:</strong>
                <ol style={{ color: 'var(--text-secondary)', marginTop: '10px', paddingLeft: '20px' }}>
                  <li>For each stop in the route:
                    <ul style={{ marginTop: '5px', paddingLeft: '20px' }}>
                      <li>Format address for geocoding (expand abbreviations, remove direction brackets)</li>
                      <li>If intersection (contains "&" or "AND"): Use <strong>GeocodingService.geocodeIntersection()</strong></li>
                      <li>Otherwise: Use <strong>GeocodingService.geocodeAddress()</strong></li>
                      <li>Add "Portland, OR" context to improve accuracy</li>
                    </ul>
                  </li>
                  <li>Geocoding uses Google Maps Geocoding API (primary) or Nominatim (fallback, currently disabled)</li>
                  <li>For each successfully geocoded stop:
                    <ul style={{ marginTop: '5px', paddingLeft: '20px' }}>
                      <li>Add coordinates in <code>[lng, lat]</code> format</li>
                      <li>Add formatted display name</li>
                      <li>Add Google Place ID (if available)</li>
                      <li>Use <strong>NeighborhoodService</strong> to get neighborhood name via reverse geocoding</li>
                    </ul>
                  </li>
                  <li>For failed geocoding: Store error message in <code>geocodeError</code> field</li>
                  <li>Rate limiting: 50ms delay between Google API requests</li>
                </ol>
              </div>
              <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '15px', borderRadius: '8px', marginBottom: '15px' }}>
                <strong style={{ color: 'var(--text-primary)' }}>Services Involved:</strong>
                <ul style={{ color: 'var(--text-secondary)', marginTop: '10px', paddingLeft: '20px' }}>
                  <li><strong>GeocodingService</strong> - Converts addresses to coordinates</li>
                  <li><strong>NeighborhoodService</strong> - Gets neighborhood names from coordinates</li>
                  <li><strong>Geocode API Routes</strong> - <code>POST /api/geocode/batch</code> for batch processing</li>
                </ul>
              </div>
              <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '15px', borderRadius: '8px' }}>
                <strong style={{ color: 'var(--text-primary)' }}>Final Route Object:</strong>
                <p style={{ color: 'var(--text-secondary)', marginTop: '10px', marginBottom: '10px' }}>
                  After geocoding, the route is saved with:
                </p>
                <ul style={{ color: 'var(--text-secondary)', paddingLeft: '20px' }}>
                  <li>All stops with coordinates (or error messages)</li>
                  <li><code>processedAt</code> timestamp</li>
                  <li><code>stats</code> object with geocoding success counts</li>
                </ul>
                <p style={{ color: 'var(--text-secondary)', marginTop: '10px' }}>
                  Saved to: <code>data/schools/{'{schoolId}'}/processed-routes/{'{filename}'}.json</code>
                </p>
              </div>
              <ExpandableExample title="Example: Geocoded Stop Data">
                <pre style={{ 
                  backgroundColor: '#1e1e1e', 
                  padding: '15px', 
                  borderRadius: '4px', 
                  overflow: 'auto',
                  color: '#d4d4d4',
                  fontSize: '13px',
                  marginBottom: '15px'
                }}>
{`{
  "id": "stop-1",
  "address": "SW Patton Rd & SW Montgomery Dr [NE]",
  "coordinates": [-122.6784, 45.5152],  // [lng, lat]
  "displayName": "SW Patton Rd & SW Montgomery Dr, Portland, OR 97201, USA",
  "placeId": "ChIJN1t_tDeuFkcRj599IhASqtg",
  "locationType": "GEOMETRIC_CENTER",
  "neighborhood": "Sylvan-Highlands",  // Added via reverse geocoding
  "time": "8:36 am",
  "direction": "NE"
}`}
                </pre>
              </ExpandableExample>
            </div>

            <div id="plotting-routes" style={{ marginBottom: '40px', scrollMarginTop: '80px' }}>
              <h3 style={{ color: 'var(--text-primary)', marginBottom: '15px', fontSize: '18px' }}>
                6. Plotting Routes on Map
              </h3>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '15px' }}>
                Processed routes are loaded and displayed on an interactive Leaflet map.
              </p>
              <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '15px', borderRadius: '8px', marginBottom: '15px' }}>
                <strong style={{ color: 'var(--text-primary)' }}>Process:</strong>
                <ol style={{ color: 'var(--text-secondary)', marginTop: '10px', paddingLeft: '20px' }}>
                  <li>User selects a school from the school list</li>
                  <li>Frontend calls <code>GET /api/data/routes?schoolId={'{schoolId}'}</code></li>
                  <li><strong>Local Routes Service</strong> loads routes from processed JSON files</li>
                  <li>Routes are converted to frontend <code>Route</code> interface format</li>
                  <li>Each route is assigned a unique color for visualization</li>
                  <li>Routes are cached in browser localStorage via <strong>Route Cache Service</strong></li>
                  <li>Map view is initialized with Leaflet</li>
                  <li>For each selected route:
                    <ul style={{ marginTop: '5px', paddingLeft: '20px' }}>
                      <li>Stop markers are placed at each geocoded stop coordinate</li>
                      <li>Route line is drawn connecting stops using <strong>Routing Service</strong></li>
                      <li>Route follows actual streets using Google Directions API or OSRM</li>
                    </ul>
                  </li>
                </ol>
              </div>
              <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '15px', borderRadius: '8px' }}>
                <strong style={{ color: 'var(--text-primary)' }}>Services Involved:</strong>
                <ul style={{ color: 'var(--text-secondary)', marginTop: '10px', paddingLeft: '20px' }}>
                  <li><strong>Local Routes Service</strong> - Loads and converts route data</li>
                  <li><strong>Route Cache Service</strong> - Manages browser caching</li>
                  <li><strong>Routing Service</strong> - Calculates route geometry between stops</li>
                  <li><strong>DirectionsService</strong> - Backend service for route calculation</li>
                  <li><strong>Data API Route</strong> - <code>GET /api/data/routes</code></li>
                </ul>
              </div>
            </div>

            <div id="route-visualization" style={{ marginBottom: '40px', scrollMarginTop: '80px' }}>
              <h3 style={{ color: 'var(--text-primary)', marginBottom: '15px', fontSize: '18px' }}>
                7. Route Visualization
              </h3>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '15px' }}>
                Routes are visualized with markers, lines, and interactive features.
              </p>
              <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '15px', borderRadius: '8px', marginBottom: '15px' }}>
                <strong style={{ color: 'var(--text-primary)' }}>Visual Elements:</strong>
                <ul style={{ color: 'var(--text-secondary)', marginTop: '10px', paddingLeft: '20px' }}>
                  <li><strong>Stop Markers</strong> - Numbered markers at each stop location</li>
                  <li><strong>Route Lines</strong> - Colored polylines following streets between stops</li>
                  <li><strong>School Marker</strong> - Special marker at school location</li>
                  <li><strong>Home Address Marker</strong> - Optional marker for user's address</li>
                  <li><strong>Route List</strong> - Sidebar showing all routes with selection checkboxes</li>
                </ul>
              </div>
              <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '15px', borderRadius: '8px', marginBottom: '15px' }}>
                <strong style={{ color: 'var(--text-primary)' }}>Route Line Calculation:</strong>
                <ol style={{ color: 'var(--text-secondary)', marginTop: '10px', paddingLeft: '20px' }}>
                  <li>For each route, collect all stop coordinates</li>
                  <li>Use <strong>Routing Service</strong> to calculate route between stops</li>
                  <li>If multiple stops: Use Google Directions API with waypoints (up to 25 per request)</li>
                  <li>If API fails: Fallback to OSRM (Open Source Routing Machine)</li>
                  <li>Decode polyline response to get coordinate array</li>
                  <li>Cache route coordinates in localStorage (24-hour TTL)</li>
                  <li>Draw polyline on map using Leaflet's <code>Polyline</code> component</li>
                </ol>
              </div>
              <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '15px', borderRadius: '8px' }}>
                <strong style={{ color: 'var(--text-primary)' }}>Interactive Features:</strong>
                <ul style={{ color: 'var(--text-secondary)', marginTop: '10px', paddingLeft: '20px' }}>
                  <li>Click markers to see stop details (address, time, neighborhood)</li>
                  <li>Toggle routes on/off via checkboxes in route list</li>
                  <li>Map auto-zooms to fit selected routes</li>
                  <li>Dark mode support via CSS variables</li>
                </ul>
              </div>
              <ExpandableExample title="UI Component: RouteList">
                <div style={{ 
                  border: '1px solid var(--border-color)', 
                  borderRadius: '4px',
                  maxHeight: '400px',
                  overflow: 'auto',
                  backgroundColor: 'var(--bg-secondary)',
                }}>
                  <div style={{ padding: '0.5rem', height: '100%' }}>
                    <RouteListBase
                      routes={[exampleRoute]}
                      config={{
                        showRouteSelection: true,
                        onRouteSelectionChange: () => {},
                        isRouteSelected: () => true,
                        onStopClick: () => {},
                      }}
                    />
                  </div>
                </div>
                <p style={{ color: 'var(--text-secondary)', marginTop: '15px', fontSize: '13px' }}>
                  <strong>Note:</strong> This is the RouteListBase component with example data. The actual RouteList component 
                  uses the Zustand store and automatically updates when routes are loaded.
                </p>
              </ExpandableExample>
            </div>

            <div id="neighborhood-exploration" style={{ marginBottom: '40px', scrollMarginTop: '80px' }}>
              <h3 style={{ color: 'var(--text-primary)', marginBottom: '15px', fontSize: '18px' }}>
                8. Neighborhood Exploration
              </h3>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '15px' }}>
                Users can explore which neighborhoods are served by bus routes.
              </p>
              <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '15px', borderRadius: '8px', marginBottom: '15px' }}>
                <strong style={{ color: 'var(--text-primary)' }}>Process:</strong>
                <ol style={{ color: 'var(--text-secondary)', marginTop: '10px', paddingLeft: '20px' }}>
                  <li>Collect all stop coordinates from selected routes</li>
                  <li>Use <strong>NeighborhoodService</strong> to get neighborhood for each coordinate</li>
                  <li>Reverse geocode coordinates using Google Maps Reverse Geocoding API</li>
                  <li>Extract neighborhood name from address components</li>
                  <li>Group stops by neighborhood</li>
                  <li>Display neighborhoods with:
                    <ul style={{ marginTop: '5px', paddingLeft: '20px' }}>
                      <li>Neighborhood name</li>
                      <li>Stop count</li>
                      <li>Routes serving that neighborhood</li>
                      <li>List of stops with addresses and coordinates</li>
                    </ul>
                  </li>
                </ol>
              </div>
              <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '15px', borderRadius: '8px', marginBottom: '15px' }}>
                <strong style={{ color: 'var(--text-primary)' }}>Services Involved:</strong>
                <ul style={{ color: 'var(--text-secondary)', marginTop: '10px', paddingLeft: '20px' }}>
                  <li><strong>NeighborhoodService</strong> - Reverse geocodes coordinates to neighborhoods</li>
                  <li><strong>Neighborhoods API Routes</strong>:
                    <ul style={{ marginTop: '5px', paddingLeft: '20px' }}>
                      <li><code>GET /api/neighborhoods/from-routes</code> - Get neighborhoods from routes</li>
                      <li><code>POST /api/neighborhoods/batch</code> - Batch get neighborhoods</li>
                    </ul>
                  </li>
                </ul>
              </div>
              <ExpandableExample title="Example: Neighborhood Data Structure">
                <pre style={{ 
                  backgroundColor: '#1e1e1e', 
                  padding: '15px', 
                  borderRadius: '4px', 
                  overflow: 'auto',
                  color: '#d4d4d4',
                  fontSize: '13px',
                  marginBottom: '15px'
                }}>
{`{
  "name": "Sylvan-Highlands",
  "count": 8,
  "routes": ["100", "101", "102"],
  "stops": [
    {
      "routeId": "route-1",
      "routeName": "100",
      "stopId": "stop-1",
      "stopAddress": "SW Patton Rd & SW Montgomery Dr",
      "coordinates": [-122.6784, 45.5152]
    }
  ]
}`}
                </pre>
              </ExpandableExample>
            </div>
          </section>

          <section id="backend-services" style={{ marginBottom: '40px', scrollMarginTop: '80px' }}>
            <h2 style={{ color: 'var(--text-primary)', marginBottom: '20px', fontSize: '24px' }}>
              Backend Services
            </h2>

            <div id="geocoding-service" style={{ marginBottom: '30px', scrollMarginTop: '80px' }}>
              <h3 style={{ color: 'var(--text-primary)', marginBottom: '10px', fontSize: '18px' }}>
                1. GeocodingService
              </h3>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '10px' }}>
                Converts addresses to coordinates using geocoding APIs.
              </p>
              <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '15px', borderRadius: '8px', marginBottom: '15px' }}>
                <strong style={{ color: 'var(--text-primary)' }}>APIs Used:</strong>
                <ul style={{ color: 'var(--text-secondary)', marginTop: '10px', paddingLeft: '20px' }}>
                  <li><strong>Google Maps Geocoding API</strong> (Primary)
                    <ul style={{ marginTop: '5px', paddingLeft: '20px' }}>
                      <li>Endpoint: <code>https://maps.googleapis.com/maps/api/geocode/json</code></li>
                      <li>API Key: <code>GOOGLE_MAPS_API_KEY</code> or <code>GOOGLE_API_KEY</code></li>
                      <li>Rate Limiting: ~50ms delay between requests</li>
                    </ul>
                  </li>
                  <li><strong>OpenStreetMap Nominatim</strong> (Fallback - Currently Disabled)
                    <ul style={{ marginTop: '5px', paddingLeft: '20px' }}>
                      <li>Endpoint: <code>https://nominatim.openstreetmap.org/search</code></li>
                      <li>Rate Limiting: 1 request/second</li>
                      <li>User-Agent: PPS-Bus-Maps/1.0 (required)</li>
                    </ul>
                  </li>
                </ul>
              </div>
              <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '15px', borderRadius: '8px', marginBottom: '15px' }}>
                <strong style={{ color: 'var(--text-primary)' }}>Data Storage:</strong>
                <p style={{ color: 'var(--text-secondary)', marginTop: '10px' }}>
                  Geocoded coordinates are stored in processed route JSON files. Each stop includes:
                </p>
                <pre style={{ 
                  backgroundColor: '#1e1e1e', 
                  padding: '15px', 
                  borderRadius: '4px', 
                  overflow: 'auto',
                  color: '#d4d4d4',
                  fontSize: '13px',
                  marginTop: '10px'
                }}>
{`{
  "id": "stop-1",
  "address": "SW Patton Rd & SW Montgomery Dr [NE]",
  "coordinates": [-122.6784, 45.5152],  // [lng, lat] format
  "displayName": "SW Patton Rd & SW Montgomery Dr, Portland, OR, USA",
  "placeId": "ChIJ...",  // Google Place ID (if available)
  "locationType": "GEOMETRIC_CENTER",
  "neighborhood": "Sylvan-Highlands",  // Added via reverse geocoding
  "time": "8:36 am",
  "direction": "NE"
}`}
                </pre>
              </div>
              <ExpandableExample title="Example: GeocodingService Response">
                <pre style={{ 
                  backgroundColor: '#1e1e1e', 
                  padding: '15px', 
                  borderRadius: '4px', 
                  overflow: 'auto',
                  color: '#d4d4d4',
                  fontSize: '13px',
                  marginBottom: '15px'
                }}>
{`// geocodeAddress() response:
{
  "success": true,
  "coordinates": [-122.6784, 45.5152],  // [lng, lat]
  "displayName": "SW Patton Rd & SW Montgomery Dr, Portland, OR 97201, USA",
  "placeId": "ChIJN1t_tDeuFkcRj599IhASqtg",
  "locationType": "GEOMETRIC_CENTER"
}

// geocodeIntersection() response (if intersection not found):
{
  "success": true,
  "coordinates": [-122.6784, 45.5152],
  "displayName": "Approximate intersection of SW Patton Rd and SW Montgomery Dr",
  "isApproximate": true,
  "geocodeWarning": "Intersection not found, using approximate location"
}`}
                </pre>
              </ExpandableExample>
            </div>

            <div id="drive-service" style={{ marginBottom: '30px', scrollMarginTop: '80px' }}>
              <h3 style={{ color: 'var(--text-primary)', marginBottom: '10px', fontSize: '18px' }}>
                2. DriveService
              </h3>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '10px' }}>
                Fetches PDF files from Google Drive folders.
              </p>
              <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '15px', borderRadius: '8px', marginBottom: '15px' }}>
                <strong style={{ color: 'var(--text-primary)' }}>APIs Used:</strong>
                <ul style={{ color: 'var(--text-secondary)', marginTop: '10px', paddingLeft: '20px' }}>
                  <li><strong>Google Drive API v3</strong> (Optional - with API key)
                    <ul style={{ marginTop: '5px', paddingLeft: '20px' }}>
                      <li>Endpoint: <code>https://www.googleapis.com/drive/v3/files</code></li>
                      <li>API Key: <code>GOOGLE_API_KEY</code></li>
                      <li>Used for: Listing files, downloading files</li>
                    </ul>
                  </li>
                  <li><strong>Google Drive Public Folder Parsing</strong> (Fallback - no API key required)
                    <ul style={{ marginTop: '5px', paddingLeft: '20px' }}>
                      <li>Endpoint: <code>https://drive.google.com/drive/folders/{'{folderId}'}</code></li>
                      <li>Method: HTML parsing with regex to extract file IDs</li>
                      <li>Download: <code>https://drive.google.com/uc?export=download&confirm=t&id={'{fileId}'}</code></li>
                    </ul>
                  </li>
                </ul>
              </div>
              <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '15px', borderRadius: '8px' }}>
                <strong style={{ color: 'var(--text-primary)' }}>Data Storage:</strong>
                <p style={{ color: 'var(--text-secondary)', marginTop: '10px' }}>
                  PDFs are stored in school-specific directories:
                </p>
                <pre style={{ 
                  backgroundColor: '#1e1e1e', 
                  padding: '15px', 
                  borderRadius: '4px', 
                  overflow: 'auto',
                  color: '#d4d4d4',
                  fontSize: '13px',
                  marginTop: '10px'
                }}>
{`data/
  schools/
    west-sylvan/
      pdfs/
        100SYL-A_effective_082625.pdf
        100SYL-P_effective_082625.pdf
        101SYL-A_effective_082625.pdf
        ...`}
                </pre>
              </div>
            </div>

            <div id="pdf-parser" style={{ marginBottom: '30px', scrollMarginTop: '80px' }}>
              <h3 style={{ color: 'var(--text-primary)', marginBottom: '10px', fontSize: '18px' }}>
                3. PdfParser
              </h3>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '10px' }}>
                Extracts route information and stop addresses from PDF text.
              </p>
              <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '15px', borderRadius: '8px', marginBottom: '15px' }}>
                <strong style={{ color: 'var(--text-primary)' }}>APIs Used:</strong>
                <ul style={{ color: 'var(--text-secondary)', marginTop: '10px', paddingLeft: '20px' }}>
                  <li><strong>pdf-parse</strong> (npm package)
                    <ul style={{ marginTop: '5px', paddingLeft: '20px' }}>
                      <li>Library: <code>pdf-parse</code></li>
                      <li>Purpose: Extract text content from PDF files</li>
                      <li>No external API calls - local processing</li>
                    </ul>
                  </li>
                </ul>
              </div>
              <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '15px', borderRadius: '8px' }}>
                <strong style={{ color: 'var(--text-primary)' }}>Data Storage:</strong>
                <p style={{ color: 'var(--text-secondary)', marginTop: '10px' }}>
                  Parsed routes are stored as JSON files. Example:
                </p>
                <pre style={{ 
                  backgroundColor: '#1e1e1e', 
                  padding: '15px', 
                  borderRadius: '4px', 
                  overflow: 'auto',
                  color: '#d4d4d4',
                  fontSize: '13px',
                  marginTop: '10px'
                }}>
{`{
  "id": "1a2b3c4d5e6f",
  "name": "100",
  "direction": "Morning",
  "filename": "100SYL-A_effective_082625.pdf",
  "stops": [
    {
      "id": "stop-1",
      "address": "SW Patton Rd & SW Montgomery Dr [NE]",
      "time": "8:36 am",
      "direction": "NE",
      "originalLine": "8:36 amSW PATTON RD @ SW MONTGOMERY DR [NE]100SYL-A(2)Stop Order #:"
    }
  ],
  "anchorName": "WEST SYLVAN GT LOADING ZONE IN DRIVEWAY",
  "processedAt": "2024-01-15T10:30:00.000Z",
  "stats": {
    "totalStops": 15,
    "geocodedStops": 14,
    "failedStops": 1
  }
}`}
                </pre>
                <p style={{ color: 'var(--text-secondary)', marginTop: '10px', fontSize: '14px' }}>
                  <strong>File Location:</strong> <code>data/schools/{'{schoolId}'}/processed-routes/{'{filename}'}.json</code>
                </p>
              </div>
            </div>

            <div id="autocomplete-service" style={{ marginBottom: '30px', scrollMarginTop: '80px' }}>
              <h3 style={{ color: 'var(--text-primary)', marginBottom: '10px', fontSize: '18px' }}>
                4. AutocompleteService
              </h3>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '10px' }}>
                Provides address autocomplete suggestions for address input fields.
              </p>
              <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '15px', borderRadius: '8px', marginBottom: '15px' }}>
                <strong style={{ color: 'var(--text-primary)' }}>APIs Used:</strong>
                <ul style={{ color: 'var(--text-secondary)', marginTop: '10px', paddingLeft: '20px' }}>
                  <li><strong>Google Places API (New)</strong> (Primary)
                    <ul style={{ marginTop: '5px', paddingLeft: '20px' }}>
                      <li>Endpoint: <code>https://places.googleapis.com/v1/places:autocomplete</code></li>
                      <li>API Key: <code>GOOGLE_API_KEY</code> or <code>GOOGLE_MAPS_API_KEY</code></li>
                      <li>Method: POST with location bias for Portland, OR</li>
                      <li>Field Mask: <code>suggestions.placePrediction.placeId, suggestions.placePrediction.structuredFormat, suggestions.placePrediction.text</code></li>
                    </ul>
                  </li>
                  <li><strong>Google Places API Place Details</strong>
                    <ul style={{ marginTop: '5px', paddingLeft: '20px' }}>
                      <li>Endpoint: <code>https://places.googleapis.com/v1/places/{'{placeId}'}</code></li>
                      <li>Purpose: Get coordinates for selected autocomplete suggestions</li>
                    </ul>
                  </li>
                  <li><strong>OpenStreetMap Nominatim</strong> (Fallback)
                    <ul style={{ marginTop: '5px', paddingLeft: '20px' }}>
                      <li>Endpoint: <code>https://nominatim.openstreetmap.org/search</code></li>
                      <li>Rate Limiting: 1 request/second</li>
                      <li>User-Agent: PPS-Bus-Maps/1.0 (required)</li>
                    </ul>
                  </li>
                </ul>
              </div>
              <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '15px', borderRadius: '8px' }}>
                <strong style={{ color: 'var(--text-primary)' }}>Data Storage:</strong>
                <p style={{ color: 'var(--text-secondary)', marginTop: '10px' }}>
                  Autocomplete results are cached in-memory with 1-hour TTL. Cache key format:
                </p>
                <pre style={{ 
                  backgroundColor: '#1e1e1e', 
                  padding: '15px', 
                  borderRadius: '4px', 
                  overflow: 'auto',
                  color: '#d4d4d4',
                  fontSize: '13px',
                  marginTop: '10px'
                }}>
{`// Cache key: "query|city|state"
// Example: "123 main st|Portland|OR"

// Cached suggestion format:
{
  "displayName": "123 Main St",
  "address": "123 Main St, Portland, OR 97201, USA",
  "coordinates": [-122.6784, 45.5152]  // [lng, lat]
}`}
                </pre>
              </div>
            </div>

            <div id="neighborhood-service" style={{ marginBottom: '30px', scrollMarginTop: '80px' }}>
              <h3 style={{ color: 'var(--text-primary)', marginBottom: '10px', fontSize: '18px' }}>
                5. NeighborhoodService
              </h3>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '10px' }}>
                Performs reverse geocoding to get neighborhood names from coordinates.
              </p>
              <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '15px', borderRadius: '8px', marginBottom: '15px' }}>
                <strong style={{ color: 'var(--text-primary)' }}>APIs Used:</strong>
                <ul style={{ color: 'var(--text-secondary)', marginTop: '10px', paddingLeft: '20px' }}>
                  <li><strong>Google Maps Reverse Geocoding API</strong>
                    <ul style={{ marginTop: '5px', paddingLeft: '20px' }}>
                      <li>Endpoint: <code>https://maps.googleapis.com/maps/api/geocode/json</code></li>
                      <li>API Key: <code>GOOGLE_MAPS_API_KEY</code> or <code>GOOGLE_API_KEY</code></li>
                      <li>Parameters: <code>latlng={'{lat}'},{'{lng}'}</code></li>
                      <li>Extracts: neighborhood, sublocality from address_components</li>
                    </ul>
                  </li>
                </ul>
              </div>
              <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '15px', borderRadius: '8px', marginBottom: '15px' }}>
                <strong style={{ color: 'var(--text-primary)' }}>Data Storage:</strong>
                <p style={{ color: 'var(--text-secondary)', marginTop: '10px' }}>
                  Neighborhood data is cached in a JSON file and in-memory:
                </p>
                <pre style={{ 
                  backgroundColor: '#1e1e1e', 
                  padding: '15px', 
                  borderRadius: '4px', 
                  overflow: 'auto',
                  color: '#d4d4d4',
                  fontSize: '13px',
                  marginTop: '10px'
                }}>
{`// Cache file: data/cache/neighborhood-cache.json
{
  "-122.6784,45.5152": "Sylvan-Highlands",
  "-122.6821,45.5123": "Sylvan-Highlands",
  "-122.6750,45.5180": "Hillsdale"
}

// Coordinates are rounded to 4 decimal places (~11m precision)
// Cache key format: "lng,lat"`}
                </pre>
              </div>
              <ExpandableExample title="Example: NeighborhoodService Response">
                <pre style={{ 
                  backgroundColor: '#1e1e1e', 
                  padding: '15px', 
                  borderRadius: '4px', 
                  overflow: 'auto',
                  color: '#d4d4d4',
                  fontSize: '13px',
                  marginBottom: '15px'
                }}>
{`// getNeighborhood() response:
{
  "success": true,
  "neighborhood": "Sylvan-Highlands",
  "fromCache": false,  // true if retrieved from cache
  "formattedAddress": "SW Patton Rd & SW Montgomery Dr, Portland, OR 97201, USA"
}

// getNeighborhoodsFromRoutes() response:
{
  "neighborhoods": [
    {
      "name": "Sylvan-Highlands",
      "count": 8,
      "routes": ["100", "101"],
      "stops": [...]
    }
  ],
  "totalRoutes": 12,
  "schoolId": "west-sylvan"
}`}
                </pre>
              </ExpandableExample>
            </div>

            <div id="street-geometry-service" style={{ marginBottom: '30px', scrollMarginTop: '80px' }}>
              <h3 style={{ color: 'var(--text-primary)', marginBottom: '10px', fontSize: '18px' }}>
                6. StreetGeometryService
              </h3>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '10px' }}>
                Finds full street geometry by finding endpoints and routing between them.
              </p>
              <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '15px', borderRadius: '8px', marginBottom: '15px' }}>
                <strong style={{ color: 'var(--text-primary)' }}>APIs Used:</strong>
                <ul style={{ color: 'var(--text-secondary)', marginTop: '10px', paddingLeft: '20px' }}>
                  <li><strong>Google Roads API</strong>
                    <ul style={{ marginTop: '5px', paddingLeft: '20px' }}>
                      <li>Endpoint: <code>https://roads.googleapis.com/v1/snapToRoads</code></li>
                      <li>Purpose: Snap coordinates to nearest road</li>
                      <li>Returns: place_id for each snapped point</li>
                    </ul>
                  </li>
                  <li><strong>Google Geocoding API</strong> (via GeocodingService)
                    <ul style={{ marginTop: '5px', paddingLeft: '20px' }}>
                      <li>Purpose: Find points along street by geocoding addresses</li>
                    </ul>
                  </li>
                  <li><strong>Google Reverse Geocoding API</strong>
                    <ul style={{ marginTop: '5px', paddingLeft: '20px' }}>
                      <li>Purpose: Verify points are on correct street</li>
                    </ul>
                  </li>
                  <li><strong>Google Directions API</strong> (via DirectionsService)
                    <ul style={{ marginTop: '5px', paddingLeft: '20px' }}>
                      <li>Purpose: Route between snapped points to get full street geometry</li>
                    </ul>
                  </li>
                </ul>
              </div>
              <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '15px', borderRadius: '8px' }}>
                <strong style={{ color: 'var(--text-primary)' }}>Data Storage:</strong>
                <p style={{ color: 'var(--text-secondary)', marginTop: '10px' }}>
                  Street geometry is returned as coordinate arrays (not persisted):
                </p>
                <pre style={{ 
                  backgroundColor: '#1e1e1e', 
                  padding: '15px', 
                  borderRadius: '4px', 
                  overflow: 'auto',
                  color: '#d4d4d4',
                  fontSize: '13px',
                  marginTop: '10px'
                }}>
{`{
  "success": true,
  "geometry": [
    [45.5152, -122.6784],  // [lat, lng] for Leaflet
    [45.5153, -122.6785],
    [45.5154, -122.6786],
    ...
  ],
  "bounds": {
    "north": 45.5200,
    "south": 45.5100,
    "east": -122.6700,
    "west": -122.6900
  },
  "responseTime": 1250,
  "method": "roads_api"
}`}
                </pre>
              </div>
            </div>

            <div id="places-service" style={{ marginBottom: '30px', scrollMarginTop: '80px' }}>
              <h3 style={{ color: 'var(--text-primary)', marginBottom: '10px', fontSize: '18px' }}>
                7. PlacesService
              </h3>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '10px' }}>
                Searches for schools and places using Google Places API.
              </p>
              <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '15px', borderRadius: '8px', marginBottom: '15px' }}>
                <strong style={{ color: 'var(--text-primary)' }}>APIs Used:</strong>
                <ul style={{ color: 'var(--text-secondary)', marginTop: '10px', paddingLeft: '20px' }}>
                  <li><strong>Google Places API (New) - Text Search</strong>
                    <ul style={{ marginTop: '5px', paddingLeft: '20px' }}>
                      <li>Endpoint: <code>https://places.googleapis.com/v1/places:searchText</code></li>
                      <li>API Key: <code>GOOGLE_API_KEY</code></li>
                      <li>Method: POST with textQuery and locationBias</li>
                      <li>Field Mask: <code>places.id,places.displayName,places.formattedAddress,places.location,places.addressComponents</code></li>
                    </ul>
                  </li>
                  <li><strong>Google Places API - Place Details</strong>
                    <ul style={{ marginTop: '5px', paddingLeft: '20px' }}>
                      <li>Endpoint: <code>https://places.googleapis.com/v1/places/{'{placeId}'}</code></li>
                      <li>Purpose: Get detailed information about a place</li>
                    </ul>
                  </li>
                </ul>
              </div>
              <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '15px', borderRadius: '8px' }}>
                <strong style={{ color: 'var(--text-primary)' }}>Data Storage:</strong>
                <p style={{ color: 'var(--text-secondary)', marginTop: '10px' }}>
                  School data is stored in <code>data/schools.json</code>:
                </p>
                <pre style={{ 
                  backgroundColor: '#1e1e1e', 
                  padding: '15px', 
                  borderRadius: '4px', 
                  overflow: 'auto',
                  color: '#d4d4d4',
                  fontSize: '13px',
                  marginTop: '10px'
                }}>
{`[
  {
    "id": "west-sylvan",
    "name": "West Sylvan",
    "address": "1301 SW 25th Ave, Portland, OR 97201",
    "coordinates": [-122.6984, 45.5123],  // [lng, lat]
    "schoolPageLink": "https://www.pps.net/westsylvan",
    "driveLink": "https://drive.google.com/drive/folders/1BC03MH02DFuUL6teeq4jkcT2THRGgzxj",
    "createdAt": "2024-01-15T10:00:00.000Z",
    "updatedAt": "2024-01-20T14:30:00.000Z",
    "schoolTypes": ["Middle School"],
    "routeCount": 12
  }
]`}
                </pre>
              </div>
            </div>

            <div id="directions-service" style={{ marginBottom: '30px', scrollMarginTop: '80px' }}>
              <h3 style={{ color: 'var(--text-primary)', marginBottom: '10px', fontSize: '18px' }}>
                8. DirectionsService
              </h3>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '10px' }}>
                Calculates routes between waypoints following actual streets.
              </p>
              <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '15px', borderRadius: '8px', marginBottom: '15px' }}>
                <strong style={{ color: 'var(--text-primary)' }}>APIs Used:</strong>
                <ul style={{ color: 'var(--text-secondary)', marginTop: '10px', paddingLeft: '20px' }}>
                  <li><strong>Google Directions API</strong> (Primary)
                    <ul style={{ marginTop: '5px', paddingLeft: '20px' }}>
                      <li>Endpoint: <code>https://maps.googleapis.com/maps/api/directions/json</code></li>
                      <li>API Key: <code>GOOGLE_MAPS_API_KEY</code> or <code>GOOGLE_API_KEY</code></li>
                      <li>Supports: Up to 25 waypoints per request</li>
                      <li>Returns: Encoded polyline that is decoded to coordinates</li>
                    </ul>
                  </li>
                  <li><strong>OSRM (Open Source Routing Machine)</strong> (Fallback)
                    <ul style={{ marginTop: '5px', paddingLeft: '20px' }}>
                      <li>Endpoint: <code>https://router.project-osrm.org/route/v1/driving</code></li>
                      <li>Format: <code>/{'{lng1}'},{'{lat1}'};{'{lng2}'},{'{lat2}'}?overview=full&geometries=polyline</code></li>
                      <li>Rate Limiting: 1 request/second recommended</li>
                      <li>No API key required</li>
                    </ul>
                  </li>
                </ul>
              </div>
              <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '15px', borderRadius: '8px' }}>
                <strong style={{ color: 'var(--text-primary)' }}>Data Storage:</strong>
                <p style={{ color: 'var(--text-secondary)', marginTop: '10px' }}>
                  Route coordinates are cached in browser localStorage (24-hour TTL):
                </p>
                <pre style={{ 
                  backgroundColor: '#1e1e1e', 
                  padding: '15px', 
                  borderRadius: '4px', 
                  overflow: 'auto',
                  color: '#d4d4d4',
                  fontSize: '13px',
                  marginTop: '10px'
                }}>
{`// Cache key: "lat1,lng1_lat2,lng2"
// Example: "45.5152,-122.6784_45.5123,-122.6821"

// Cached route format:
{
  "coordinates": [
    [45.5152, -122.6784],  // [lat, lng] for Leaflet
    [45.5153, -122.6785],
    ...
  ],
  "timestamp": 1705320000000
}`}
                </pre>
              </div>
            </div>

            <div id="scheduler-service" style={{ marginBottom: '30px', scrollMarginTop: '80px' }}>
              <h3 style={{ color: 'var(--text-primary)', marginBottom: '10px', fontSize: '18px' }}>
                9. SchedulerService
              </h3>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '10px' }}>
                Automatically checks Google Drive for updated PDFs and processes them.
              </p>
              <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '15px', borderRadius: '8px', marginBottom: '15px' }}>
                <strong style={{ color: 'var(--text-primary)' }}>APIs Used:</strong>
                <ul style={{ color: 'var(--text-secondary)', marginTop: '10px', paddingLeft: '20px' }}>
                  <li><strong>node-cron</strong> (npm package)
                    <ul style={{ marginTop: '5px', paddingLeft: '20px' }}>
                      <li>Schedule: Daily at 2:00 AM (America/Los_Angeles timezone)</li>
                      <li>Cron Expression: <code>0 2 * * *</code></li>
                    </ul>
                  </li>
                  <li><strong>DriveService</strong> (for listing/downloading files)</li>
                  <li><strong>PdfParser</strong> (for parsing PDFs)</li>
                  <li><strong>GeocodingService</strong> (for geocoding stops)</li>
                </ul>
              </div>
              <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '15px', borderRadius: '8px' }}>
                <strong style={{ color: 'var(--text-primary)' }}>Data Storage:</strong>
                <p style={{ color: 'var(--text-secondary)', marginTop: '10px' }}>
                  Scheduler state is stored in <code>data/scheduler-state.json</code>:
                </p>
                <pre style={{ 
                  backgroundColor: '#1e1e1e', 
                  padding: '15px', 
                  borderRadius: '4px', 
                  overflow: 'auto',
                  color: '#d4d4d4',
                  fontSize: '13px',
                  marginTop: '10px'
                }}>
{`{
  "enabled": true,
  "lastRun": "2024-01-20T10:00:00.000Z",
  "lastRunStatus": "success",
  "lastRunError": null,
  "nextRun": "2024-01-21T10:00:00.000Z"
}`}
                </pre>
              </div>
            </div>
          </section>

          <section id="frontend-services" style={{ marginBottom: '40px', scrollMarginTop: '80px' }}>
            <h2 style={{ color: 'var(--text-primary)', marginBottom: '20px', fontSize: '24px' }}>
              Frontend Services
            </h2>

            <div id="api-service" style={{ marginBottom: '30px', scrollMarginTop: '80px' }}>
              <h3 style={{ color: 'var(--text-primary)', marginBottom: '10px', fontSize: '18px' }}>
                1. API Service (api.ts)
              </h3>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '10px' }}>
                Client-side wrapper for backend API endpoints.
              </p>
              <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '15px', borderRadius: '8px', marginBottom: '15px' }}>
                <strong style={{ color: 'var(--text-primary)' }}>Endpoints:</strong>
                <ul style={{ color: 'var(--text-secondary)', marginTop: '10px', paddingLeft: '20px' }}>
                  <li><code>GET /api/drive/folder/{'{folderId}'}</code> - List files in Drive folder</li>
                  <li><code>POST /api/drive/folder/{'{folderId}'}/parse</code> - Parse folder and process PDFs</li>
                  <li><code>POST /api/geocode/address</code> - Geocode single address</li>
                  <li><code>POST /api/geocode/batch</code> - Batch geocode addresses</li>
                  <li><code>GET /api/geocode/autocomplete</code> - Get autocomplete suggestions</li>
                  <li><code>POST /api/geocode/reverse</code> - Reverse geocode coordinates</li>
                  <li><code>POST /api/neighborhoods/from-coordinates</code> - Get neighborhood from coordinates</li>
                  <li><code>POST /api/neighborhoods/batch</code> - Batch get neighborhoods</li>
                  <li><code>GET /api/neighborhoods/from-routes</code> - Get neighborhoods from routes</li>
                  <li><code>GET /api/neighborhoods/list</code> - Get neighborhoods list</li>
                  <li><code>GET /api/data/routes</code> - Get processed routes</li>
                  <li><code>GET /api/schools</code> - Get schools list</li>
                </ul>
              </div>
            </div>

            <div id="local-routes-service" style={{ marginBottom: '30px', scrollMarginTop: '80px' }}>
              <h3 style={{ color: 'var(--text-primary)', marginBottom: '10px', fontSize: '18px' }}>
                2. Local Routes Service (localRoutes.ts)
              </h3>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '10px' }}>
                Loads routes from backend API and converts to frontend format.
              </p>
              <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '15px', borderRadius: '8px', marginBottom: '15px' }}>
                <strong style={{ color: 'var(--text-primary)' }}>Data Format:</strong>
                <p style={{ color: 'var(--text-secondary)', marginTop: '10px' }}>
                  Converts processed route format to Route interface:
                </p>
                <pre style={{ 
                  backgroundColor: '#1e1e1e', 
                  padding: '15px', 
                  borderRadius: '4px', 
                  overflow: 'auto',
                  color: '#d4d4d4',
                  fontSize: '13px',
                  marginTop: '10px'
                }}>
{`interface Route {
  id: string;
  name: string;  // Route number only, e.g., "100"
  direction?: 'Morning' | 'Afternoon' | null;
  filename?: string;
  stops: Stop[];
  color: string;  // Assigned by store
  isSelected: boolean;
  geocodingProgress?: {
    total: number;
    geocoded: number;
    isGeocoding: boolean;
  };
}`}
                </pre>
              </div>
              <ExpandableExample title="Example: Local Routes Service Output">
                <pre style={{ 
                  backgroundColor: '#1e1e1e', 
                  padding: '15px', 
                  borderRadius: '4px', 
                  overflow: 'auto',
                  color: '#d4d4d4',
                  fontSize: '13px',
                  marginBottom: '15px'
                }}>
{`// loadLocalRoutes() returns Route[]:
[
  {
    "id": "route-1",
    "name": "100",
    "direction": "Morning",
    "filename": "100SYL-A_effective_082625.pdf",
    "stops": [
      {
        "id": "stop-1",
        "address": "SW Patton Rd & SW Montgomery Dr [NE]",
        "coordinates": [-122.6784, 45.5152],
        "neighborhood": "Sylvan-Highlands",
        "time": "8:36 am"
      }
    ],
    "color": "#4ECDC4",
    "isSelected": true,
    "geocodingProgress": {
      "total": 15,
      "geocoded": 14,
      "isGeocoding": false
    }
  }
]`}
                </pre>
              </ExpandableExample>
            </div>

            <div id="routing-service" style={{ marginBottom: '30px', scrollMarginTop: '80px' }}>
              <h3 style={{ color: 'var(--text-primary)', marginBottom: '10px', fontSize: '18px' }}>
                3. Routing Service (routing.ts)
              </h3>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '10px' }}>
                Fetches route geometry between points using backend Directions API.
              </p>
              <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '15px', borderRadius: '8px', marginBottom: '15px' }}>
                <strong style={{ color: 'var(--text-primary)' }}>Endpoints:</strong>
                <ul style={{ color: 'var(--text-secondary)', marginTop: '10px', paddingLeft: '20px' }}>
                  <li><code>POST /api/routes/calculate</code> - Calculate route between waypoints</li>
                  <li>Fallback: Direct OSRM API calls if backend fails</li>
                </ul>
              </div>
              <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '15px', borderRadius: '8px' }}>
                <strong style={{ color: 'var(--text-primary)' }}>Data Storage:</strong>
                <p style={{ color: 'var(--text-secondary)', marginTop: '10px' }}>
                  Routes are cached in localStorage with 24-hour TTL:
                </p>
                <pre style={{ 
                  backgroundColor: '#1e1e1e', 
                  padding: '15px', 
                  borderRadius: '4px', 
                  overflow: 'auto',
                  color: '#d4d4d4',
                  fontSize: '13px',
                  marginTop: '10px'
                }}>
{`// Cache key: "osrm_route_cache"
{
  "45.5152,-122.6784_45.5123,-122.6821": {
    "coordinates": [[45.5152, -122.6784], ...],
    "timestamp": 1705320000000
  }
}`}
                </pre>
              </div>
            </div>

            <div id="route-cache-service" style={{ marginBottom: '30px', scrollMarginTop: '80px' }}>
              <h3 style={{ color: 'var(--text-primary)', marginBottom: '10px', fontSize: '18px' }}>
                4. Route Cache Service (routeCache.ts)
              </h3>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '10px' }}>
                Manages caching of route data in browser localStorage.
              </p>
              <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '15px', borderRadius: '8px' }}>
                <strong style={{ color: 'var(--text-primary)' }}>Data Storage:</strong>
                <p style={{ color: 'var(--text-secondary)', marginTop: '10px' }}>
                  Routes are cached with versioning:
                </p>
                <pre style={{ 
                  backgroundColor: '#1e1e1e', 
                  padding: '15px', 
                  borderRadius: '4px', 
                  overflow: 'auto',
                  color: '#d4d4d4',
                  fontSize: '13px',
                  marginTop: '10px'
                }}>
{`// Cache key: "pps-bus-routes-cache"
{
  "version": 2,
  "timestamp": "2024-01-20T10:00:00.000Z",
  "routes": [
    {
      "id": "1a2b3c4d",
      "name": "100",
      "direction": "Morning",
      "stops": [
        {
          "id": "stop-1",
          "address": "SW Patton Rd & SW Montgomery Dr",
          "coordinates": [-122.6784, 45.5152]
        }
      ]
    }
  ]
}`}
                </pre>
              </div>
            </div>
          </section>

          <section id="data-examples" style={{ marginBottom: '40px', scrollMarginTop: '80px' }}>
            <h2 style={{ color: 'var(--text-primary)', marginBottom: '20px', fontSize: '24px' }}>
              Complete Data Entry Examples
            </h2>

            <div id="processed-route-example" style={{ marginBottom: '30px', scrollMarginTop: '80px' }}>
              <h3 style={{ color: 'var(--text-primary)', marginBottom: '10px', fontSize: '18px' }}>
                Processed Route Example
              </h3>
              <pre style={{ 
                backgroundColor: '#1e1e1e', 
                padding: '15px', 
                borderRadius: '4px', 
                overflow: 'auto',
                color: '#d4d4d4',
                fontSize: '13px'
              }}>
{`{
  "id": "1a2b3c4d5e6f7g8h9i0j",
  "name": "100",
  "direction": "Morning",
  "filename": "100SYL-A_effective_082625.pdf",
  "stops": [
    {
      "id": "stop-1",
      "address": "SW Patton Rd & SW Montgomery Dr [NE]",
      "coordinates": [-122.6784, 45.5152],
      "displayName": "SW Patton Rd & SW Montgomery Dr, Portland, OR 97201, USA",
      "placeId": "ChIJN1t_tDeuFkcRj599IhASqtg",
      "locationType": "GEOMETRIC_CENTER",
      "neighborhood": "Sylvan-Highlands",
      "time": "8:36 am",
      "direction": "NE",
      "originalLine": "8:36 amSW PATTON RD @ SW MONTGOMERY DR [NE]100SYL-A(2)Stop Order #:",
      "isSchoolStop": false,
      "skipGeocoding": false
    },
    {
      "id": "stop-2",
      "address": "3737 SW Humphrey Blvd [NE]",
      "coordinates": [-122.6821, 45.5123],
      "displayName": "3737 SW Humphrey Blvd, Portland, OR 97221, USA",
      "placeId": "ChIJK1t_tDeuFkcRj599IhASqtg",
      "locationType": "ROOFTOP",
      "neighborhood": "Sylvan-Highlands",
      "time": "8:54 am",
      "direction": "NE",
      "originalLine": "8:54 am3737 SW HUMPHREY BLVD [NE]100SYL-A(12)Stop Order #:",
      "isSchoolStop": false,
      "skipGeocoding": false
    }
  ],
  "anchorName": "WEST SYLVAN GT LOADING ZONE IN DRIVEWAY",
  "rawText": "Route: 100SYL-A\\nAnchor Name:WEST SYLVAN GT LOADING ZONE IN DRIVEWAY\\n...",
  "processedAt": "2024-01-20T10:30:00.000Z",
  "stats": {
    "totalStops": 15,
    "geocodedStops": 14,
    "failedStops": 1
  }
}`}
              </pre>
            </div>

            <div id="school-entry-example" style={{ marginBottom: '30px', scrollMarginTop: '80px' }}>
              <h3 style={{ color: 'var(--text-primary)', marginBottom: '10px', fontSize: '18px' }}>
                School Entry Example
              </h3>
              <pre style={{ 
                backgroundColor: '#1e1e1e', 
                padding: '15px', 
                borderRadius: '4px', 
                overflow: 'auto',
                color: '#d4d4d4',
                fontSize: '13px'
              }}>
{`{
  "id": "west-sylvan",
  "name": "West Sylvan",
  "address": "1301 SW 25th Ave, Portland, OR 97201",
  "coordinates": [-122.6984, 45.5123],
  "schoolPageLink": "https://www.pps.net/westsylvan",
  "driveLink": "https://drive.google.com/drive/folders/1BC03MH02DFuUL6teeq4jkcT2THRGgzxj",
  "createdAt": "2024-01-15T10:00:00.000Z",
  "updatedAt": "2024-01-20T14:30:00.000Z",
  "schoolTypes": ["Middle School"],
  "routeCount": 12
}`}
              </pre>
            </div>

            <div id="neighborhood-data-example" style={{ marginBottom: '30px', scrollMarginTop: '80px' }}>
              <h3 style={{ color: 'var(--text-primary)', marginBottom: '10px', fontSize: '18px' }}>
                Neighborhood Data Example
              </h3>
              <pre style={{ 
                backgroundColor: '#1e1e1e', 
                padding: '15px', 
                borderRadius: '4px', 
                overflow: 'auto',
                color: '#d4d4d4',
                fontSize: '13px'
              }}>
{`{
  "name": "Sylvan-Highlands",
  "count": 8,
  "routes": ["100", "101", "102"],
  "stops": [
    {
      "routeId": "1a2b3c4d",
      "routeName": "100",
      "stopId": "stop-1",
      "stopAddress": "SW Patton Rd & SW Montgomery Dr",
      "coordinates": [-122.6784, 45.5152]
    },
    {
      "routeId": "1a2b3c4d",
      "routeName": "100",
      "stopId": "stop-2",
      "stopAddress": "3737 SW Humphrey Blvd",
      "coordinates": [-122.6821, 45.5123]
    }
  ]
}`}
              </pre>
            </div>
          </section>

          <section id="file-structure" style={{ marginBottom: '40px', scrollMarginTop: '80px' }}>
            <h2 style={{ color: 'var(--text-primary)', marginBottom: '20px', fontSize: '24px' }}>
              File Structure
            </h2>
            <pre style={{ 
              backgroundColor: '#1e1e1e', 
              padding: '15px', 
              borderRadius: '4px', 
              overflow: 'auto',
              color: '#d4d4d4',
              fontSize: '13px'
            }}>
{`data/
├── schools.json                    # All schools metadata
├── scheduler-state.json            # Scheduler status
├── cache/
│   └── neighborhood-cache.json     # Cached neighborhood lookups
└── schools/
    └── {schoolId}/                  # e.g., "west-sylvan"
        ├── pdfs/                    # Original PDF files
        │   ├── 100SYL-A_effective_082625.pdf
        │   └── 100SYL-P_effective_082625.pdf
        └── processed-routes/        # Processed route JSON files
            ├── 100SYL-A_effective_082625.json
            └── 100SYL-P_effective_082625.json`}
            </pre>
          </section>

          <section id="coordinate-format" style={{ marginBottom: '40px', scrollMarginTop: '80px' }}>
            <h2 style={{ color: 'var(--text-primary)', marginBottom: '20px', fontSize: '24px' }}>
              Coordinate Format Notes
            </h2>
            <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '15px', borderRadius: '8px' }}>
              <ul style={{ color: 'var(--text-secondary)', paddingLeft: '20px' }}>
                <li><strong>Internal Format:</strong> <code>[lng, lat]</code> - GeoJSON standard (longitude first)</li>
                <li><strong>Leaflet Format:</strong> <code>[lat, lng]</code> - Leaflet expects latitude first</li>
                <li><strong>Google APIs:</strong> Use <code>lat,lng</code> format in query strings</li>
                <li><strong>Storage:</strong> All stored coordinates use <code>[lng, lat]</code> format</li>
                <li><strong>Conversion:</strong> Convert to <code>[lat, lng]</code> when passing to Leaflet components</li>
              </ul>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
