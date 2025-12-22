import { useState, useEffect, useRef } from 'react';
import { Header } from '../components/Header';
import { Sidebar } from '../components/Sidebar';
import { SEO } from '../components/SEO';
import { ExpandableExample } from '../components/ExpandableExample';
import { RouteListBase } from '../components/RouteListBase';
import { SchoolList } from '../components/SchoolList';
import { RouteIcon } from '../components/RouteIcon';
import { Route, School, Stop } from '../types';

interface Section {
  id: string;
  title: string;
  subsections?: { id: string; title: string; isHighlighted?: boolean }[];
}

const sections: Section[] = [
  {
    id: 'functionality',
    title: 'Functionality and Interactions',
    subsections: [
      { id: 'understanding-school-routes', title: '1. Understanding School Routes' },
      { id: 'checking-pdfs-drive', title: '2. Checking PDFs in Drive Links' },
      { id: 'processing-pdfs', title: '3. Processing PDFs' },
      { id: 'step-by-step-processing-flow', title: '⭐ Step-by-Step Processing Flow', isHighlighted: true },
      { id: 'creating-routes', title: '4. Creating Routes' },
      { id: 'geocoding-stops', title: '5. Geocoding Stops' },
      { id: 'plotting-routes', title: '6. Plotting Routes on Map' },
      { id: 'route-visualization', title: '7. Route Visualization' },
      { id: 'neighborhood-exploration', title: '8. Neighborhood Exploration' },
      { id: 'homepage-experience', title: '9. Home Page Experience' },
      { id: 'mobile-gestures', title: '10. Mobile Interactions & Gestures' },
    ],
  },
  {
    id: 'backend-services',
    title: 'Backend Services',
    subsections: [
      { id: 'geocoding-service', title: '1. GeocodingService' },
      { id: 'drive-service', title: '2. DriveService' },
      { id: 'pdf-parser', title: '3. PdfParser' },
      { id: 'route-processor', title: '4. RouteProcessor' },
      { id: 'autocomplete-service', title: '5. AutocompleteService' },
      { id: 'neighborhood-service', title: '6. NeighborhoodService' },
      { id: 'street-geometry-service', title: '7. StreetGeometryService' },
      { id: 'places-service', title: '8. PlacesService' },
      { id: 'directions-service', title: '9. DirectionsService' },
      { id: 'scheduler-service', title: '10. SchedulerService' },
      { id: 'verification-service', title: '11. VerificationService' },
      { id: 'google-sites-service', title: '12. GoogleSitesService' },
      { id: 'restart-service', title: '13. RestartService' },
      { id: 'job-queue-system', title: '14. Job Queue System' },
      { id: 'maintenance-scripts', title: '15. Maintenance Scripts' },
    ],
  },
  {
    id: 'frontend-services',
    title: 'Frontend Services',
    subsections: [
      { id: 'api-service', title: '1. API Service' },
      { id: 'frontend-routing', title: '2. Frontend Routing' },
      { id: 'local-routes-service', title: '3. Local Routes Service' },
      { id: 'routing-service', title: '4. Routing Service' },
      { id: 'route-cache-service', title: '5. Route Cache Service' },
      { id: 'theme-service', title: '6. Theme Service' },
      { id: 'global-store', title: '7. Global Store (Zustand)' },
      { id: 'pwa-support', title: '8. PWA & Home Screen Support' },
    ],
  },
  {
    id: 'url-state-sync',
    title: 'URL & State Synchronization',
    subsections: [
      { id: 'url-schema', title: '1. URL Schema & Hierarchy' },
      { id: 'ui-url-interactions', title: '2. UI-to-URL Interactions' },
      { id: 'url-to-ui-restoration', title: '3. URL-to-UI Restoration' },
      { id: 'context-aware-navigation', title: '4. Context-Aware Navigation' },
      { id: 'state-logic-rules', title: '5. Critical State Rules' },
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
  {
    id: 'analytics-instrumentation',
    title: 'Analytics & Instrumentation',
    subsections: [
      { id: 'ga4-setup', title: '1. GA4 Setup & Service' },
      { id: 'event-tracking', title: '2. Event Tracking Schema' },
      { id: 'page-view-tracking', title: '3. Page View Tracking' },
    ],
  },
  {
    id: 'seo-discovery',
    title: 'Discovery & SEO',
    subsections: [
      { id: 'meta-tags-management', title: '1. Meta Tags Management' },
      { id: 'robots-txt', title: '2. Robots.txt' },
      { id: 'sitemap-generation', title: '3. Sitemap Generation' },
    ],
  },
  {
    id: 'deployment',
    title: 'Deployment',
    subsections: [
      { id: 'deployment-script', title: '1. Deployment Script (deploy.sh)' },
      { id: 'deployment-process', title: '2. Deployment Process' },
    ],
  },
  {
    id: 'testing-infrastructure',
    title: 'Testing Infrastructure',
    subsections: [
      { id: 'backend-testing', title: '1. Backend Testing (Node --test)' },
      { id: 'frontend-testing', title: '2. Frontend Testing (Vitest)' },
      { id: 'build-verification', title: '3. Build & Type Verification' },
      { id: 'running-tests', title: '4. Running Tests' },
    ],
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
      neighborhood: 'Sylvan-Highlands',
      time: '8:54 am',
      direction: 'NE',
    },
  ],
  color: '#FFFFFF',
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
      <SEO 
        title="Technical Documentation" 
        description="Comprehensive technical documentation for the PPS Bus Maps application, including backend services, frontend architecture, and data processing."
      />
      <Header />
      <div style={{ 
        display: 'flex', 
        flex: 1, 
        overflow: 'hidden' 
      }}>
        <Sidebar
          persistenceKey="sidebar-width-tech"
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
                          color: subsection.isHighlighted ? 'var(--text-primary)' : 'var(--text-secondary)',
                          fontSize: '13px',
                          fontWeight: subsection.isHighlighted ? 'bold' : 'normal',
                          transition: 'all 0.2s ease',
                          marginBottom: '2px',
                          backgroundColor: subsection.isHighlighted ? 'var(--bg-tertiary)' : 'transparent',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)';
                          e.currentTarget.style.color = 'var(--text-primary)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = subsection.isHighlighted ? 'var(--bg-tertiary)' : 'transparent';
                          e.currentTarget.style.color = subsection.isHighlighted ? 'var(--text-primary)' : 'var(--text-secondary)';
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
  "createdAt": "2024-01-15T10:00:00.000Z",
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
                PDFs are processed through a unified processor architecture that handles parsing, geocoding, and route creation. The system uses a shared <strong>RouteProcessor</strong> service that is called by three different entry points: CLI script, batch API, and scheduled processor.
              </p>
              
              <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '15px', borderRadius: '8px', marginBottom: '15px' }}>
                <strong style={{ color: 'var(--text-primary)' }}>Processor Architecture:</strong>
                <p style={{ color: 'var(--text-secondary)', marginTop: '10px', marginBottom: '10px' }}>
                  All PDF processing uses a shared <strong>RouteProcessor</strong> service to ensure consistent behavior:
                </p>
                <ul style={{ color: 'var(--text-secondary)', marginTop: '10px', paddingLeft: '20px' }}>
                  <li><strong>Single Processor</strong> (<code>scripts/process-single-pdf.js</code>) - CLI tool for processing one PDF</li>
                  <li><strong>Batch Processor</strong> (<code>backend/routes/processPdfs.js</code>) - API endpoint that enqueues processing jobs (processed by <strong>WorkerService</strong>)</li>
                  <li><strong>Scheduled Processor</strong> (<code>backend/services/schedulerService.js</code>) - Automated daily processing that enqueues jobs via the Job Queue</li>
                </ul>
                <p style={{ color: 'var(--text-secondary)', marginTop: '10px' }}>
                  <strong>Hierarchy:</strong> Scheduled/Batch Trigger → Job Queue → WorkerService → RouteProcessor
                </p>
              </div>

              <div id="step-by-step-processing-flow" style={{ 
                backgroundColor: 'var(--bg-secondary)', 
                padding: '20px', 
                borderRadius: '12px', 
                marginBottom: '20px',
                border: '2px solid #FFFFFF',
                boxShadow: '0 4px 12px rgba(78, 205, 196, 0.15)',
                scrollMarginTop: '80px',
              }}>
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '10px', 
                  marginBottom: '15px' 
                }}>
                  <span style={{ fontSize: '20px', color: '#FFFFFF' }}>⭐</span>
                  <strong style={{ color: 'var(--text-primary)', fontSize: '18px' }}>
                    Step-by-Step Processing Flow
                  </strong>
                </div>
                <div style={{ 
                  color: 'var(--text-secondary)', 
                  marginTop: '10px',
                  lineHeight: '1.8',
                }}>
                  <div style={{ marginBottom: '20px', paddingLeft: '0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                      <i className="fas fa-file-pdf" style={{ fontSize: '14px', color: 'var(--text-primary)', flexShrink: 0 }}></i>
                      <div>
                        <strong style={{ color: 'var(--text-primary)', fontSize: '16px' }}>Parse PDF</strong>
                        <ul style={{ marginTop: '8px', paddingLeft: '20px', color: 'var(--text-secondary)' }}>
                          <li style={{ marginBottom: '4px' }}>Extract text content using <code style={{ backgroundColor: 'var(--bg-primary)', padding: '2px 6px', borderRadius: '3px' }}>pdf-parse</code> library</li>
                          <li style={{ marginBottom: '4px' }}>Use <strong>PdfParser</strong> to parse route information:
                            <ul style={{ marginTop: '6px', paddingLeft: '20px' }}>
                              <li>Extract route name and direction from filename (e.g., "100SYL-A" → "100", "Morning")</li>
                              <li>Extract anchor name (school loading zone)</li>
                              <li>Parse stop addresses from PDF text using regex patterns</li>
                              <li>Format addresses (expand abbreviations, normalize street names)</li>
                              <li>Mark loading zone stops with <code style={{ backgroundColor: 'var(--bg-primary)', padding: '2px 6px', borderRadius: '3px' }}>skipGeocoding: true</code></li>
                            </ul>
                          </li>
                        </ul>
                      </div>
                    </div>
                  </div>
                  <div style={{ marginBottom: '20px', paddingLeft: '0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                      <i className="fas fa-school" style={{ fontSize: '14px', color: 'var(--text-primary)', flexShrink: 0 }}></i>
                      <div>
                        <strong style={{ color: 'var(--text-primary)', fontSize: '16px' }}>Match School</strong>
                        <ul style={{ marginTop: '8px', paddingLeft: '20px', color: 'var(--text-secondary)' }}>
                          <li style={{ marginBottom: '4px' }}>Load <code style={{ backgroundColor: 'var(--bg-primary)', padding: '2px 6px', borderRadius: '3px' }}>data/schools.json</code></li>
                          <li style={{ marginBottom: '4px' }}>Match anchor name to school by finding school name in anchor name</li>
                          <li style={{ marginBottom: '4px' }}>Extract school address and coordinates from matched school</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                  <div style={{ marginBottom: '20px', paddingLeft: '0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                      <i className="fas fa-map-marker-alt" style={{ fontSize: '14px', color: 'var(--text-primary)', flexShrink: 0 }}></i>
                      <div>
                        <strong style={{ color: 'var(--text-primary)', fontSize: '16px' }}>Geocode Stops</strong>
                        <ul style={{ marginTop: '8px', paddingLeft: '20px', color: 'var(--text-secondary)' }}>
                          <li style={{ marginBottom: '4px' }}>Use <strong>GeocodingService</strong> to geocode all stops</li>
                          <li style={{ marginBottom: '4px' }}>Skip stops marked with <code style={{ backgroundColor: 'var(--bg-primary)', padding: '2px 6px', borderRadius: '3px' }}>skipGeocoding: true</code> (loading zones)</li>
                          <li style={{ marginBottom: '4px' }}>Add neighborhood information via reverse geocoding</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                  <div style={{ marginBottom: '20px', paddingLeft: '0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                      <i className="fas fa-graduation-cap" style={{ fontSize: '14px', color: 'var(--text-primary)', flexShrink: 0 }}></i>
                      <div>
                        <strong style={{ color: 'var(--text-primary)', fontSize: '16px' }}>Add School Stop</strong>
                        <ul style={{ marginTop: '8px', paddingLeft: '20px', color: 'var(--text-secondary)' }}>
                          <li style={{ marginBottom: '4px' }}>Create school stop using exact address and coordinates from <code style={{ backgroundColor: 'var(--bg-primary)', padding: '2px 6px', borderRadius: '3px' }}>schools.json</code></li>
                          <li style={{ marginBottom: '4px' }}>Add school stop at beginning (Afternoon routes) or end (Morning routes) of route</li>
                          <li style={{ marginBottom: '4px' }}>Mark with <code style={{ backgroundColor: 'var(--bg-primary)', padding: '2px 6px', borderRadius: '3px' }}>isSchoolStop: true</code></li>
                        </ul>
                      </div>
                    </div>
                  </div>
                  <div style={{ marginBottom: '20px', paddingLeft: '0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                      <i className="fas fa-filter" style={{ fontSize: '14px', color: 'var(--text-primary)', flexShrink: 0 }}></i>
                      <div>
                        <strong style={{ color: 'var(--text-primary)', fontSize: '16px' }}>Filter Loading Zones</strong>
                        <ul style={{ marginTop: '8px', paddingLeft: '20px', color: 'var(--text-secondary)' }}>
                          <li style={{ marginBottom: '4px' }}>Remove all stops with <code style={{ backgroundColor: 'var(--bg-primary)', padding: '2px 6px', borderRadius: '3px' }}>skipGeocoding: true</code> from final route</li>
                          <li style={{ marginBottom: '4px' }}>Loading zones are not actual bus stops (where buses park at night)</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                  <div style={{ marginBottom: '20px', paddingLeft: '0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                      <RouteIcon size={14} color="var(--text-primary)" style={{ flexShrink: 0 }} />
                      <div>
                        <strong style={{ color: 'var(--text-primary)', fontSize: '16px' }}>Calculate Route Geometry</strong>
                        <ul style={{ marginTop: '8px', paddingLeft: '20px', color: 'var(--text-secondary)' }}>
                          <li style={{ marginBottom: '4px' }}>Use <strong>DirectionsService</strong> to calculate street-following path between stops</li>
                          <li style={{ marginBottom: '4px' }}>Convert coordinates from <code style={{ backgroundColor: 'var(--bg-primary)', padding: '2px 6px', borderRadius: '3px' }}>[lng, lat]</code> to <code style={{ backgroundColor: 'var(--bg-primary)', padding: '2px 6px', borderRadius: '3px' }}>[lat, lng]</code> for directions API</li>
                          <li style={{ marginBottom: '4px' }}>Store route geometry as array of <code style={{ backgroundColor: 'var(--bg-primary)', padding: '2px 6px', borderRadius: '3px' }}>[lat, lng]</code> coordinates</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                  <div style={{ marginBottom: '20px', paddingLeft: '0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                      <i className="fas fa-map" style={{ fontSize: '14px', color: 'var(--text-primary)', flexShrink: 0 }}></i>
                      <div>
                        <strong style={{ color: 'var(--text-primary)', fontSize: '16px' }}>Aggregate Neighborhoods</strong>
                        <ul style={{ marginTop: '8px', paddingLeft: '20px', color: 'var(--text-secondary)' }}>
                          <li style={{ marginBottom: '4px' }}>Collect unique neighborhoods from all stops</li>
                          <li style={{ marginBottom: '4px' }}>Store in route's <code style={{ backgroundColor: 'var(--bg-primary)', padding: '2px 6px', borderRadius: '3px' }}>neighborhoods</code> array</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                  <div style={{ marginBottom: '20px', paddingLeft: '0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                      <i className="fas fa-cog" style={{ fontSize: '14px', color: 'var(--text-primary)', flexShrink: 0 }}></i>
                      <div>
                        <strong style={{ color: 'var(--text-primary)', fontSize: '16px' }}>Create Final Route Object</strong>
                        <ul style={{ marginTop: '8px', paddingLeft: '20px', color: 'var(--text-secondary)' }}>
                          <li style={{ marginBottom: '4px' }}>Calculate statistics (total stops, geocoded stops, failed stops)</li>
                          <li style={{ marginBottom: '4px' }}>Add <code style={{ backgroundColor: 'var(--bg-primary)', padding: '2px 6px', borderRadius: '3px' }}>processedAt</code> timestamp</li>
                          <li style={{ marginBottom: '4px' }}>Include all metadata (filename, fileId, modifiedTime if available)</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                  <div style={{ marginBottom: '20px', paddingLeft: '0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                      <i className="fas fa-save" style={{ fontSize: '14px', color: 'var(--text-primary)', flexShrink: 0 }}></i>
                      <div>
                        <strong style={{ color: 'var(--text-primary)', fontSize: '16px' }}>Save to File</strong>
                        <ul style={{ marginTop: '8px', paddingLeft: '20px', color: 'var(--text-secondary)' }}>
                          <li style={{ marginBottom: '4px' }}>Save processed route to <code style={{ backgroundColor: 'var(--bg-primary)', padding: '2px 6px', borderRadius: '3px' }}>data/schools/{'{schoolId}'}/processed-routes/{'{filename}'}.json</code></li>
                          <li style={{ marginBottom: '4px' }}>Overwrites existing file if reprocessing</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '15px', borderRadius: '8px', marginBottom: '15px' }}>
                <strong style={{ color: 'var(--text-primary)' }}>Entry Points:</strong>
                <ul style={{ color: 'var(--text-secondary)', marginTop: '10px', paddingLeft: '20px' }}>
                  <li><strong>CLI Script:</strong> <code>node scripts/process-single-pdf.js &lt;path-to-pdf&gt;</code>
                    <ul style={{ marginTop: '5px', paddingLeft: '20px' }}>
                      <li>Processes a single PDF file from local filesystem</li>
                      <li>Used for testing and manual processing</li>
                    </ul>
                  </li>
                  <li><strong>Batch API:</strong> <code>POST /api/process-pdfs/process/{'{schoolId}'}</code>
                    <ul style={{ marginTop: '5px', paddingLeft: '20px' }}>
                      <li>Processes all PDFs for a school from <code>data/schools/{'{schoolId}'}/pdfs/</code></li>
                      <li>Used by Verification Page "Process PDFs" and "Reprocess" buttons</li>
                      <li>Calls single processor for each PDF in sequence</li>
                    </ul>
                  </li>
                  <li><strong>Scheduled Processor:</strong> Automatic daily processing at 2:00 AM
                    <ul style={{ marginTop: '5px', paddingLeft: '20px' }}>
                      <li>Downloads PDFs from Google Drive for all schools</li>
                      <li>Processes each PDF using the shared processor</li>
                      <li>Enqueued as background jobs via Job Queue System</li>
                    </ul>
                  </li>
                </ul>
              </div>

              <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '15px', borderRadius: '8px' }}>
                <strong style={{ color: 'var(--text-primary)' }}>Services Involved:</strong>
                <ul style={{ color: 'var(--text-secondary)', marginTop: '10px', paddingLeft: '20px' }}>
                  <li><strong>RouteProcessor</strong> - Core processing logic (shared by all entry points)</li>
                  <li><strong>PdfParser</strong> - Extracts and parses route data from PDF text</li>
                  <li><strong>GeocodingService</strong> - Converts addresses to coordinates</li>
                  <li><strong>NeighborhoodService</strong> - Gets neighborhood names from coordinates</li>
                  <li><strong>DirectionsService</strong> - Calculates street-following route geometry</li>
                  <li><strong>DriveService</strong> - Downloads PDF files (for scheduled processor)</li>
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
                  <strong>Note:</strong> This shows how a route appears in the RouteList component. Routes are automatically 
                  grouped by their primary neighborhood. The component displays stops with their addresses, times, and neighborhoods.
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
                      <li>Route follows actual streets using Google Directions API</li>
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
                  <li><strong>Stop Markers</strong> - Numbered markers at each stop location featuring a "lens" effect (transparent window) that reveals the map behind. When selected, markers transition to a larger circular pin with pulse and bounce animations, and the time is hidden for a cleaner focus.</li>
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
                  <li>If API fails: Fallback to straight-line connection</li>
                  <li>Decode polyline response to get coordinate array</li>
                  <li>Cache route coordinates in localStorage (24-hour TTL)</li>
                  <li>Draw polyline on map using Leaflet's <code>Polyline</code> component</li>
                </ol>
              </div>
              <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '15px', borderRadius: '8px' }}>
                <strong style={{ color: 'var(--text-primary)' }}>Interactive Features:</strong>
                <ul style={{ color: 'var(--text-secondary)', marginTop: '10px', paddingLeft: '20px' }}>
                  <li>Click markers to see stop details (address, time, neighborhood)</li>
                  <li><strong>Selection State</strong> - Selected stop pins use a high-visibility circular style with a selection bounce and pulse animation</li>
                  <li><strong>Find My Stop</strong> - Automatically find and select the closest bus stop to the user's home address for the selected school</li>
                  <li>Toggle routes on/off via checkboxes in route list</li>
                  <li>Routes are grouped by neighborhood with visual headings</li>
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

            <div id="homepage-experience" style={{ marginBottom: '40px', scrollMarginTop: '80px' }}>
              <h3 style={{ color: 'var(--text-primary)', marginBottom: '15px', fontSize: '18px' }}>
                9. Home Page Experience
              </h3>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '15px' }}>
                The home page provides a landing experience designed to help users find their specific bus stop quickly.
              </p>
              <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '15px', borderRadius: '8px', marginBottom: '15px' }}>
                <strong style={{ color: 'var(--text-primary)' }}>Key Features:</strong>
                <ul style={{ color: 'var(--text-secondary)', marginTop: '10px', paddingLeft: '20px' }}>
                  <li><strong>Hero Section:</strong> Full viewport height (100vh) landing area with primary search controls</li>
                  <li><strong>Address Autocomplete:</strong> Real-time address suggestions using Google Places Autocomplete API</li>
                  <li><strong>School Search:</strong> Filterable list of schools, sorted by proximity if address is provided</li>
                  <li><strong>FAQ Section:</strong> Comprehensive list of common questions, presented in a full-width layout</li>
                  <li><strong>Consolidated Footer:</strong> Centralized navigation for secondary pages like School Directory, Neighborhoods, About, and Contact</li>
                </ul>
              </div>
            </div>

            <div id="mobile-gestures" style={{ marginBottom: '40px', scrollMarginTop: '80px' }}>
              <h3 style={{ color: 'var(--text-primary)', marginBottom: '15px', fontSize: '18px' }}>
                10. Mobile Interactions & Gestures
              </h3>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '15px' }}>
                The mobile experience uses a "bottom sheet" pattern for school and stop details, featuring bulletproof swipe-to-close interactions implemented via <code>MapInfoPanel.tsx</code>.
              </p>
              <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '15px', borderRadius: '8px', marginBottom: '15px' }}>
                <strong style={{ color: 'var(--text-primary)' }}>Gesture Implementation Details:</strong>
                <ul style={{ color: 'var(--text-secondary)', marginTop: '10px', paddingLeft: '20px' }}>
                  <li><strong>Performance:</strong> Uses direct DOM manipulation (<code>panelRef.current.style.transform</code>) during gestures to bypass React's render cycle, ensuring 60fps performance on mobile devices.</li>
                  <li><strong>Thresholds:</strong> Panel closes if swiped down more than 120px, or if a "flick" is detected with a velocity greater than 0.5px/ms.</li>
                  <li><strong>Gesture Hijacking Prevention:</strong> The swipe-to-close gesture only activates if the user starts the gesture at the top of the scrollable content (<code>scrollTop &lt;= 0</code>).</li>
                  <li><strong>Dismissal Behavior:</strong> Panel can only be dismissed via a downward swipe gesture or by clicking the "X" close button. Tapping outside the panel is intentionally disabled on mobile to allow direct map interaction.</li>
                  <li><strong>Visual Feedback:</strong> Features smooth snap-back animations using <code>cubic-bezier(0.4, 0, 0.2, 1)</code>. The background remains transparent on mobile to ensure the map is always visible and interactable.</li>
                  <li><strong>Layering:</strong> The panel's <code>z-index</code> is set to 900, ensuring it stays below the main navigation menu and other high-priority UI overlays.</li>
                  <li><strong>CSS Optimizations:</strong> Uses <code>will-change: transform</code> and <code>touch-action: none</code> to optimize for mobile GPU acceleration and prevent browser default gesture interference.</li>
                </ul>
              </div>
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
              <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '15px', borderRadius: '8px', marginTop: '15px' }}>
                <strong style={{ color: 'var(--text-primary)' }}>Route Versioning (Upcoming & Superseded):</strong>
                <ul style={{ color: 'var(--text-secondary)', marginTop: '10px', paddingLeft: '20px' }}>
                  <li><strong>Upcoming Routes:</strong>
                    <ul style={{ marginTop: '5px', paddingLeft: '20px' }}>
                      <li>Determined by parsing <code>_effective_MMDDYY</code> from the PDF filename.</li>
                      <li>If the effective date is in the future (tomorrow or later), the route displays with a "(Starting DATE)" label next to its number.</li>
                      <li>These are displayed separately in the UI to allow families to preview future schedule changes.</li>
                    </ul>
                  </li>
                  <li><strong>Superseded Routes:</strong>
                    <ul style={{ marginTop: '5px', paddingLeft: '20px' }}>
                      <li>If multiple versions of a "current" route exist for the same number and direction, only the one with the <strong>latest effective date</strong> (that is ≤ today) is returned by the frontend service.</li>
                      <li>This ensures users only see the most current version of a route when multiple past versions are stored.</li>
                    </ul>
                  </li>
                </ul>
              </div>
            </div>

            <div id="route-processor" style={{ marginBottom: '30px', scrollMarginTop: '80px' }}>
              <h3 style={{ color: 'var(--text-primary)', marginBottom: '10px', fontSize: '18px' }}>
                4. RouteProcessor
              </h3>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '10px' }}>
                Core service that processes a single PDF from buffer to final processed route. This is the shared processing logic used by all entry points (CLI script, batch API, and scheduled processor).
              </p>
              <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '15px', borderRadius: '8px', marginBottom: '15px' }}>
                <strong style={{ color: 'var(--text-primary)' }}>Function:</strong>
                <p style={{ color: 'var(--text-secondary)', marginTop: '10px', marginBottom: '10px' }}>
                  <code>processSinglePDF(pdfBuffer, filename, fileId, options)</code>
                </p>
                <ul style={{ color: 'var(--text-secondary)', marginTop: '10px', paddingLeft: '20px' }}>
                  <li><strong>pdfBuffer</strong> - PDF file buffer (Buffer object)</li>
                  <li><strong>filename</strong> - PDF filename (e.g., "100SYL-A_effective_082625.pdf")</li>
                  <li><strong>fileId</strong> - Optional file ID (for Drive files)</li>
                  <li><strong>options</strong> - Processing options:
                    <ul style={{ marginTop: '5px', paddingLeft: '20px' }}>
                      <li><code>logPrefix</code> - Prefix for log messages (e.g., "[Scheduler]")</li>
                      <li><code>saveToFile</code> - Whether to save the processed route to file (default: false)</li>
                      <li><code>outputPath</code> - Optional custom output path</li>
                    </ul>
                  </li>
                </ul>
              </div>
              <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '15px', borderRadius: '8px', marginBottom: '15px' }}>
                <strong style={{ color: 'var(--text-primary)' }}>Processing Steps:</strong>
                <ol style={{ color: 'var(--text-secondary)', marginTop: '10px', paddingLeft: '20px' }}>
                  <li><strong>Parse PDF</strong> - Uses <strong>PdfParser</strong> to extract route and stops from PDF text</li>
                  <li><strong>Match School</strong> - Matches anchor name to school in <code>schools.json</code> to get school address/coordinates</li>
                  <li><strong>Geocode Stops</strong> - Uses <strong>GeocodingService</strong> to convert all stop addresses to coordinates</li>
                  <li><strong>Add School Stop</strong> - Adds school stop from <code>schools.json</code> at beginning (Afternoon) or end (Morning) of route</li>
                  <li><strong>Filter Loading Zones</strong> - Removes all stops with <code>skipGeocoding: true</code> (loading zones are not actual bus stops)</li>
                  <li><strong>Calculate Route Geometry</strong> - Uses <strong>DirectionsService</strong> to calculate street-following path between stops</li>
                  <li><strong>Aggregate Neighborhoods</strong> - Collects unique neighborhoods from all stops</li>
                  <li><strong>Create Final Route Object</strong> - Assembles complete route with metadata, stats, and geometry</li>
                  <li><strong>Save to File</strong> (if <code>saveToFile: true</code>) - Saves to <code>data/schools/{'{schoolId}'}/processed-routes/{'{filename}'}.json</code></li>
                </ol>
              </div>
              <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '15px', borderRadius: '8px', marginBottom: '15px' }}>
                <strong style={{ color: 'var(--text-primary)' }}>Used By:</strong>
                <ul style={{ color: 'var(--text-secondary)', marginTop: '10px', paddingLeft: '20px' }}>
                  <li><strong>CLI Script</strong> (<code>scripts/process-single-pdf.js</code>) - Processes one PDF from command line</li>
                  <li><strong>Batch Processor</strong> (<code>backend/routes/processPdfs.js</code>) - Processes all PDFs for a school (calls this function in a loop)</li>
                  <li><strong>Scheduled Processor</strong> (<code>backend/services/schedulerService.js</code>) - Processes PDFs downloaded from Google Drive</li>
                </ul>
              </div>
              <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '15px', borderRadius: '8px', marginBottom: '15px' }}>
                <strong style={{ color: 'var(--text-primary)' }}>Key Features:</strong>
                <ul style={{ color: 'var(--text-secondary)', marginTop: '10px', paddingLeft: '20px' }}>
                  <li><strong>Single Source of Truth</strong> - All processing logic in one place ensures consistent behavior</li>
                  <li><strong>Automatic Loading Zone Filtering</strong> - Removes loading zone stops (marked with <code>skipGeocoding: true</code>) from final route</li>
                  <li><strong>School Stop Integration</strong> - Automatically adds school stop from <code>schools.json</code> with verified address/coordinates</li>
                  <li><strong>Route Geometry Calculation</strong> - Calculates street-following path between stops for accurate visualization</li>
                  <li><strong>Neighborhood Aggregation</strong> - Collects and stores unique neighborhoods the route passes through</li>
                </ul>
              </div>
              <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '15px', borderRadius: '8px' }}>
                <strong style={{ color: 'var(--text-primary)' }}>Data Storage:</strong>
                <p style={{ color: 'var(--text-secondary)', marginTop: '10px' }}>
                  Processed routes are saved to: <code>data/schools/{'{schoolId}'}/processed-routes/{'{filename}'}.json</code>
                </p>
                <p style={{ color: 'var(--text-secondary)', marginTop: '10px' }}>
                  The route object includes:
                </p>
                <ul style={{ color: 'var(--text-secondary)', marginTop: '10px', paddingLeft: '20px' }}>
                  <li>Route metadata (id, name, direction, filename)</li>
                  <li>All stops with coordinates (excluding loading zones)</li>
                  <li>School stop (if matched from schools.json)</li>
                  <li>Route geometry (street-following path)</li>
                  <li>Neighborhoods array</li>
                  <li>Processing statistics (total stops, geocoded, failed)</li>
                  <li>Processing timestamp</li>
                </ul>
              </div>
            </div>

            <div id="autocomplete-service" style={{ marginBottom: '30px', scrollMarginTop: '80px' }}>
              <h3 style={{ color: 'var(--text-primary)', marginBottom: '10px', fontSize: '18px' }}>
                5. AutocompleteService
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
                      <li><strong>Road Snapping:</strong> House addresses are automatically snapped to the nearest street centerline using the Google Roads API to improve distance calculations for cul-de-sacs.</li>
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
                6. NeighborhoodService
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
                7. StreetGeometryService
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
                8. PlacesService
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
                9. DirectionsService
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
                10. SchedulerService
              </h3>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '10px' }}>
                Automatically checks Google Drive for updated PDFs, downloads them, and processes them using the shared <strong>RouteProcessor</strong> service. <strong>Note:</strong> This service is only active in development environments.
              </p>
              <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '15px', borderRadius: '8px', marginBottom: '15px' }}>
                <strong style={{ color: 'var(--text-primary)' }}>APIs Used:</strong>
                <ul style={{ color: 'var(--text-secondary)', marginTop: '10px', paddingLeft: '20px' }}>
                  <li><strong>node-cron</strong> (npm package)
                    <ul style={{ marginTop: '5px', paddingLeft: '20px' }}>
                      <li>Schedule: Daily at 2:00 AM (America/Los_Angeles timezone)</li>
                      <li>Cron Expression: <code>0 2 * * *</code></li>
                      <li><strong>Availability:</strong> Only runs in development (local) mode. Disabled in production.</li>
                    </ul>
                  </li>
                  <li><strong>PdfSyncJobQueue</strong> (for enqueueing PDF sync jobs)</li>
                  <li><strong>WorkerService</strong> (processes the enqueued jobs via polling in dev)</li>
                  <li><strong>RouteProcessor</strong> (for processing downloaded PDFs)</li>
                </ul>
              </div>
              <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '15px', borderRadius: '8px', marginBottom: '15px' }}>
                <strong style={{ color: 'var(--text-primary)' }}>Process:</strong>
                <ol style={{ color: 'var(--text-secondary)', marginTop: '10px', paddingLeft: '20px' }}>
                  <li>Scheduler runs daily at 2:00 AM (if enabled and in dev mode)</li>
                  <li>Loads all schools with Drive links from <code>data/schools.json</code></li>
                  <li>Enqueues PDF sync jobs for each school using <strong>PdfSyncJobQueue</strong></li>
                  <li>Jobs are processed by <strong>WorkerService</strong> polling worker in development</li>
                  <li>For each downloaded PDF:
                    <ul style={{ marginTop: '5px', paddingLeft: '20px' }}>
                      <li>Downloads PDF from Google Drive using <strong>DriveService</strong></li>
                      <li>Saves PDF to <code>data/schools/{'{schoolId}'}/pdfs/</code></li>
                      <li>Processes PDF using <strong>RouteProcessor.processSinglePDF()</strong></li>
                      <li>Saves processed route to <code>data/schools/{'{schoolId}'}/processed-routes/</code></li>
                    </ul>
                  </li>
                  <li>Results are stored in <code>data/pdf-sync-status.json</code></li>
                </ol>
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

            <div id="verification-service" style={{ marginBottom: '30px', scrollMarginTop: '80px' }}>
              <h3 style={{ color: 'var(--text-primary)', marginBottom: '10px', fontSize: '18px' }}>
                11. VerificationService
              </h3>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '10px' }}>
                Validates school Google Sites and Drive links to ensure initial data is correct before the scheduler uses it.
              </p>
              <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '15px', borderRadius: '8px', marginBottom: '15px' }}>
                <strong style={{ color: 'var(--text-primary)' }}>Functionality:</strong>
                <ul style={{ color: 'var(--text-secondary)', marginTop: '10px', paddingLeft: '20px' }}>
                  <li><strong>verifyGoogleSitesLink()</strong> - Verifies a Google Sites link for a school:
                    <ul style={{ marginTop: '5px', paddingLeft: '20px' }}>
                      <li>Checks if the page is accessible (HTTP HEAD request)</li>
                      <li>Fetches page content to check if school name appears</li>
                      <li>Looks for Drive links on the page for cross-reference</li>
                      <li>Returns validation result with errors and warnings</li>
                    </ul>
                  </li>
                  <li><strong>verifyDriveLink()</strong> - Verifies a Google Drive folder link:
                    <ul style={{ marginTop: '5px', paddingLeft: '20px' }}>
                      <li>Extracts folder ID from various Drive URL formats</li>
                      <li>Checks if folder is accessible</li>
                      <li>Lists PDF files in the folder using DriveService</li>
                      <li>Validates that PDFs are present and accessible</li>
                      <li>Returns validation result with PDF count</li>
                    </ul>
                  </li>
                  <li><strong>verifySchoolLinks()</strong> - Verifies both Sites and Drive links for a school:
                    <ul style={{ marginTop: '5px', paddingLeft: '20px' }}>
                      <li>Calls both verification methods</li>
                      <li>Returns combined result with overall validity</li>
                      <li>Includes local PDF count and file list</li>
                    </ul>
                  </li>
                  <li><strong>findStrangeStops()</strong> - Scans all processed routes for coordinate issues:
                    <ul style={{ marginTop: '5px', paddingLeft: '20px' }}>
                      <li>Checks for missing coordinates or [0, 0] coordinates</li>
                      <li>Validates coordinates are within Portland Metro bounds</li>
                      <li>Generates detailed report of problematic stops</li>
                    </ul>
                  </li>
                  <li><strong>verifySchoolStops()</strong> - Validates school stops across all routes:
                    <ul style={{ marginTop: '5px', paddingLeft: '20px' }}>
                      <li>Ensures every route has a school stop (<code>isSchoolStop: true</code>)</li>
                      <li>Matches school addresses and coordinates against <code>schools.json</code></li>
                      <li>Verifies correct placement (last for Morning, first for Afternoon)</li>
                    </ul>
                  </li>
                  <li><strong>fixStrangeStops()</strong> - Automatically corrects common data issues:
                    <ul style={{ marginTop: '5px', paddingLeft: '20px' }}>
                      <li>Uses <code>schools.json</code> data to fix "Loading Zone" stops</li>
                      <li>Removes incorrect geocoding (e.g., I-5 highway errors)</li>
                      <li>Clears route geometry to trigger recalculation</li>
                    </ul>
                  </li>
                </ul>
              </div>
              <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '15px', borderRadius: '8px', marginBottom: '15px' }}>
                <strong style={{ color: 'var(--text-primary)' }}>Data Storage:</strong>
                <p style={{ color: 'var(--text-secondary)', marginTop: '10px' }}>
                  Verification reports are stored in <code>data/verification-report.json</code>:
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
  "timestamp": "2024-01-20T10:00:00.000Z",
  "totalSchools": 25,
  "summary": {
    "validSitesLinks": 20,
    "invalidSitesLinks": 3,
    "missingSitesLinks": 2,
    "validDriveLinks": 22,
    "invalidDriveLinks": 2,
    "missingDriveLinks": 1,
    "fullyValid": 18,
    "partiallyValid": 5,
    "invalid": 2
  },
  "schools": [
    {
      "schoolId": "west-sylvan",
      "schoolName": "West Sylvan",
      "sitesLink": {
        "valid": true,
        "accessible": true,
        "schoolNameFound": true,
        "errors": [],
        "warnings": []
      },
      "driveLinkResult": {
        "valid": true,
        "accessible": true,
        "hasPdfs": true,
        "pdfCount": 12,
        "errors": [],
        "warnings": []
      },
      "overallValid": true,
      "localPdfCount": 12,
      "localPdfFiles": ["100SYL-A_effective_082625.pdf", ...]
    }
  ]
}`}
                </pre>
              </div>
              <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '15px', borderRadius: '8px' }}>
                <strong style={{ color: 'var(--text-primary)' }}>Rate Limiting:</strong>
                <p style={{ color: 'var(--text-secondary)', marginTop: '10px' }}>
                  Uses 500ms delay between requests to avoid rate limiting when verifying multiple schools.
                </p>
              </div>
            </div>

            <div id="google-sites-service" style={{ marginBottom: '30px', scrollMarginTop: '80px' }}>
              <h3 style={{ color: 'var(--text-primary)', marginBottom: '10px', fontSize: '18px' }}>
                12. GoogleSitesService
              </h3>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '10px' }}>
                Discovers school pages and Drive links by scraping Google Sites pages. Used to automatically find school links when adding new schools.
              </p>
              <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '15px', borderRadius: '8px', marginBottom: '15px' }}>
                <strong style={{ color: 'var(--text-primary)' }}>Functionality:</strong>
                <ul style={{ color: 'var(--text-secondary)', marginTop: '10px', paddingLeft: '20px' }}>
                  <li><strong>findSchoolPageLink()</strong> - Finds Google Sites page for a school:
                    <ul style={{ marginTop: '5px', paddingLeft: '20px' }}>
                      <li>Tries multiple URL patterns to handle different naming conventions</li>
                      <li>Base URL: <code>https://sites.google.com/pps.net/gt-bus-schedule/GT-Bus-Schedules</code></li>
                      <li>Patterns tried: original ID, ID without "west-" prefix, ID without hyphens, ID with underscores</li>
                      <li>Returns the first accessible URL found, or null if none found</li>
                    </ul>
                  </li>
                  <li><strong>extractDriveLinks()</strong> - Extracts Google Drive folder links from a Google Sites page:
                    <ul style={{ marginTop: '5px', paddingLeft: '20px' }}>
                      <li>Scrapes HTML for Drive links in href attributes</li>
                      <li>Finds embedded Drive folders in iframe src attributes</li>
                      <li>Extracts Drive URLs from JavaScript/JSON data</li>
                      <li>Looks for folder IDs in HTML attributes</li>
                      <li>Normalizes all found URLs to standard format</li>
                      <li>Returns array of unique Drive folder links</li>
                    </ul>
                  </li>
                  <li><strong>findBestDriveLink()</strong> - Validates and selects the best Drive link:
                    <ul style={{ marginTop: '5px', paddingLeft: '20px' }}>
                      <li>Prioritizes links that look like folders</li>
                      <li>Validates accessibility of each link</li>
                      <li>Returns first valid folder link, or null if none valid</li>
                    </ul>
                  </li>
                  <li><strong>discoverSchoolLinks()</strong> - Discovers both Sites and Drive links for a school:
                    <ul style={{ marginTop: '5px', paddingLeft: '20px' }}>
                      <li>Finds Google Sites page link</li>
                      <li>Extracts Drive links from the page</li>
                      <li>Validates and selects best Drive link</li>
                      <li>Returns both links or nulls if not found</li>
                    </ul>
                  </li>
                  <li><strong>extractFolderId()</strong> - Extracts folder ID from various Drive URL formats:
                    <ul style={{ marginTop: '5px', paddingLeft: '20px' }}>
                      <li>Supports: <code>/drive/folders/FOLDER_ID</code>, <code>/open?id=FOLDER_ID</code>, <code>/embeddedfolderview?id=FOLDER_ID</code>, etc.</li>
                    </ul>
                  </li>
                  <li><strong>normalizeDriveUrl()</strong> - Normalizes Drive URLs to standard format</li>
                  <li><strong>validateFolder()</strong> - Validates that a Drive folder is accessible</li>
                </ul>
              </div>
              <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '15px', borderRadius: '8px', marginBottom: '15px' }}>
                <strong style={{ color: 'var(--text-primary)' }}>Usage:</strong>
                <p style={{ color: 'var(--text-secondary)', marginTop: '10px', marginBottom: '10px' }}>
                  Used when adding new schools to automatically discover their Google Sites page and Drive folder links. The service scrapes the PPS Google Sites directory to find school pages and extract embedded Drive links.
                </p>
              </div>
              <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '15px', borderRadius: '8px' }}>
                <strong style={{ color: 'var(--text-primary)' }}>Rate Limiting:</strong>
                <p style={{ color: 'var(--text-secondary)', marginTop: '10px' }}>
                  Uses 1 second delay between requests to avoid rate limiting when discovering multiple schools.
                </p>
              </div>
            </div>

            <div id="restart-service" style={{ marginBottom: '30px', scrollMarginTop: '80px' }}>
              <h3 style={{ color: 'var(--text-primary)', marginBottom: '10px', fontSize: '18px' }}>
                13. RestartService
              </h3>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '10px' }}>
                Handles process restarts for backend and frontend servers using script-based approach. Allows remote restart of server processes via API endpoints.
              </p>
              <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '15px', borderRadius: '8px', marginBottom: '15px' }}>
                <strong style={{ color: 'var(--text-primary)' }}>Methods:</strong>
                <ul style={{ color: 'var(--text-secondary)', marginTop: '10px', paddingLeft: '20px' }}>
                  <li><strong>restartProcess(processName)</strong> - Restart a server process:
                    <ul style={{ marginTop: '5px', paddingLeft: '20px' }}>
                      <li>Valid process names: <code>'pps-backend'</code> or <code>'pps-frontend'</code></li>
                      <li>Uses script-based restart approach</li>
                      <li>Runs appropriate restart script from <code>scripts/</code> directory</li>
                      <li>Returns success/failure status with message</li>
                    </ul>
                  </li>
                  <li><strong>getProcessStatus(processName)</strong> - Get status of a server process:
                    <ul style={{ marginTop: '5px', paddingLeft: '20px' }}>
                      <li>Checks if process is running on expected port</li>
                      <li>Backend: Port 3001, Frontend: Port 5173</li>
                      <li>Uses <code>lsof</code> command to check port usage</li>
                      <li>Returns process status or "not found" if process not running</li>
                    </ul>
                  </li>
                </ul>
              </div>
              <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '15px', borderRadius: '8px', marginBottom: '15px' }}>
                <strong style={{ color: 'var(--text-primary)' }}>API Endpoints:</strong>
                <ul style={{ color: 'var(--text-secondary)', marginTop: '10px', paddingLeft: '20px' }}>
                  <li><code>POST /api/servers/restart</code> - Restart a server process
                    <ul style={{ marginTop: '5px', paddingLeft: '20px' }}>
                      <li>Body: <code>{'{ "processName": "pps-backend" | "pps-frontend" }'}</code></li>
                      <li>Response: <code>{'{ "success": true/false, "message": "..." }'}</code></li>
                    </ul>
                  </li>
                  <li><code>GET /api/servers/status/:processName</code> - Get process status
                    <ul style={{ marginTop: '5px', paddingLeft: '20px' }}>
                      <li>Response: <code>{'{ "success": true/false, "status": {...}, "message": "..." }'}</code></li>
                    </ul>
                  </li>
                </ul>
              </div>
              <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '15px', borderRadius: '8px' }}>
                <strong style={{ color: 'var(--text-primary)' }}>Implementation Details:</strong>
                <ul style={{ color: 'var(--text-secondary)', marginTop: '10px', paddingLeft: '20px' }}>
                  <li>Uses Node.js <code>spawn</code> to run restart scripts</li>
                  <li>Scripts located in <code>scripts/restart-backend.js</code> and <code>scripts/restart-frontend.js</code></li>
                  <li>Status checking uses <code>lsof</code> system command to check port occupancy</li>
                  <li>Designed for development and production environments</li>
                </ul>
              </div>
            </div>

            <div id="job-queue-system" style={{ marginBottom: '30px', scrollMarginTop: '80px' }}>
              <h3 style={{ color: 'var(--text-primary)', marginBottom: '10px', fontSize: '18px' }}>
                14. Job Queue System
              </h3>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '10px' }}>
                Background job processing system for PDF synchronization and other async tasks. Uses persistent history for job tracking and a polling worker for local development.
              </p>
              <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '15px', borderRadius: '8px', marginBottom: '15px' }}>
                <strong style={{ color: 'var(--text-primary)' }}>Components:</strong>
                <ul style={{ color: 'var(--text-secondary)', marginTop: '10px', paddingLeft: '20px' }}>
                  <li><strong>BaseJobQueue</strong> - Abstract base class defining job queue interface</li>
                  <li><strong>JobQueue</strong> - Concrete implementation using persistent history (Redis/BullMQ removed)</li>
                  <li><strong>PdfSyncJobQueue</strong> - Specialized queue for PDF sync operations</li>
                  <li><strong>WorkerService</strong> - Worker service that processes jobs via polling in development</li>
                </ul>
              </div>
              <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '15px', borderRadius: '8px', marginBottom: '15px' }}>
                <strong style={{ color: 'var(--text-primary)' }}>Implementation Details:</strong>
                <ul style={{ color: 'var(--text-secondary)', marginTop: '10px', paddingLeft: '20px' }}>
                  <li><strong>Development Mode:</strong> Uses a polling worker that checks the queue every 5 seconds for new jobs.</li>
                  <li><strong>Production Mode:</strong> Background jobs and polling are <strong>DISABLED</strong> in production to save resources.</li>
                  <li><strong>Data Storage:</strong> All jobs are tracked in <code>data/job-history.json</code> for persistence across restarts.</li>
                  <li><strong>Resource Usage:</strong> Redis and BullMQ have been stripped out to minimize server resource consumption.</li>
                </ul>
              </div>
              <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '15px', borderRadius: '8px', marginBottom: '15px' }}>
                <strong style={{ color: 'var(--text-primary)' }}>Job Types:</strong>
                <ul style={{ color: 'var(--text-secondary)', marginTop: '10px', paddingLeft: '20px' }}>
                  <li><code>PDF_SYNC</code> - Download PDFs for a school from Google Drive</li>
                  <li><code>PDF_PROCESS</code> - Process/parse PDFs for a school</li>
                  <li><code>DRIVE_CHECK</code> - Check for Drive updates</li>
                </ul>
              </div>
              <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '15px', borderRadius: '8px', marginBottom: '15px' }}>
                <strong style={{ color: 'var(--text-primary)' }}>Job Statuses:</strong>
                <ul style={{ color: 'var(--text-secondary)', marginTop: '10px', paddingLeft: '20px' }}>
                  <li><code>waiting</code> - Job is queued and waiting to be processed</li>
                  <li><code>active</code> - Job is currently being processed by a worker</li>
                  <li><code>completed</code> - Job completed successfully</li>
                  <li><code>failed</code> - Job failed after all retry attempts</li>
                  <li><code>cancelled</code> - Job was cancelled by user</li>
                </ul>
              </div>
              <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '15px', borderRadius: '8px', marginBottom: '15px' }}>
                <strong style={{ color: 'var(--text-primary)' }}>Worker Service (Development Mode Only):</strong>
                <ul style={{ color: 'var(--text-secondary)', marginTop: '10px', paddingLeft: '20px' }}>
                  <li>Uses a polling worker that checks the queue every 5 seconds</li>
                  <li>Processes jobs synchronously</li>
                  <li>Maintains 2-second minimum interval between jobs (rate limiting)</li>
                  <li>Jobs are persisted in <code>data/jobs-history/jobs.json</code></li>
                </ul>
              </div>
              <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '15px', borderRadius: '8px', marginBottom: '15px' }}>
                <strong style={{ color: 'var(--text-primary)' }}>PDF Sync Job Process:</strong>
                <ol style={{ color: 'var(--text-secondary)', marginTop: '10px', paddingLeft: '20px' }}>
                  <li>Extract folder ID from school's Drive link</li>
                  <li>Get existing PDFs from local storage</li>
                  <li>List PDF files from Google Drive folder</li>
                  <li>Compare modified times and local existence to determine which files need downloading or processing</li>
                  <li>Download new/updated PDFs (with rate limiting)</li>
                  <li>Process PDFs that are new, updated, or missing processed JSON results</li>
                  <li>Clean up orphaned local PDFs and JSON files that are no longer present on Drive</li>
                  <li>Update sync status in <code>data/pdf-sync-status.json</code></li>
                  <li>Return result with download, processing, and deletion counts</li>
                </ol>
              </div>
              <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '15px', borderRadius: '8px', marginBottom: '15px' }}>
                <strong style={{ color: 'var(--text-primary)' }}>Configuration:</strong>
                <ul style={{ color: 'var(--text-secondary)', marginTop: '10px', paddingLeft: '20px' }}>
                  <li><code>WORKER_CONCURRENCY</code> - Number of concurrent workers (default: 2, development only)</li>
                  <li><code>JOB_RETRY_ATTEMPTS</code> - Number of retry attempts (default: 3)</li>
                  <li><code>JOB_RETRY_DELAY</code> - Retry delay in ms (default: 5000)</li>
                  <li><code>JOB_HISTORY_RETENTION_DAYS</code> - Days to keep completed jobs (default: 30)</li>
                  <li><code>JOB_FAILED_RETENTION_DAYS</code> - Days to keep failed jobs (default: 7)</li>
                </ul>
              </div>
              <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '15px', borderRadius: '8px' }}>
                <strong style={{ color: 'var(--text-primary)' }}>Data Storage:</strong>
                <p style={{ color: 'var(--text-secondary)', marginTop: '10px' }}>
                  Job data is stored in persistent JSON files:
                </p>
                <ul style={{ color: 'var(--text-secondary)', marginTop: '10px', paddingLeft: '20px' }}>
                  <li><code>data/jobs-history/jobs.json</code> - Persistent job history</li>
                  <li><code>data/pdf-sync-status.json</code> - School-specific sync timestamps</li>
                </ul>
                <pre style={{ 
                  backgroundColor: '#1e1e1e', 
                  padding: '15px', 
                  borderRadius: '4px', 
                  overflow: 'auto',
                  color: '#d4d4d4',
                  fontSize: '13px',
                  marginTop: '10px'
                }}>
{`// data/pdf-sync-status.json
{
  "west-sylvan": {
    "lastModifiedPdf": "2024-01-20T10:00:00.000Z",
    "lastChecked": "2024-01-20T10:05:00.000Z"
  },
  "lincoln": {
    "lastModifiedPdf": "2024-01-19T15:30:00.000Z",
    "lastChecked": "2024-01-20T10:05:00.000Z"
  }
}`}
                </pre>
              </div>
              <ExpandableExample title="Example: Job Status Response">
                <pre style={{ 
                  backgroundColor: '#1e1e1e', 
                  padding: '15px', 
                  borderRadius: '4px', 
                  overflow: 'auto',
                  color: '#d4d4d4',
                  fontSize: '13px',
                  marginBottom: '15px'
                }}>
{`// GET /api/jobs/{jobId} response:
{
  "id": "123",
  "name": "pdf-sync",
  "data": {
    "schoolId": "west-sylvan"
  },
  "status": "completed",
  "progress": 100,
  "result": {
    "schoolId": "west-sylvan",
    "downloaded": 3,
    "processed": 3,
    "skipped": 5,
    "deleted": 2,
    "errors": [],
    "totalInDrive": 8,
    "lastModifiedPdf": "2024-01-20T10:00:00.000Z",
    "lastChecked": "2024-01-20T10:05:00.000Z"
  },
  "error": null,
  "createdAt": "2024-01-20T10:00:00.000Z",
  "processedAt": "2024-01-20T10:01:00.000Z",
  "finishedAt": "2024-01-20T10:05:00.000Z",
  "attemptsMade": 1,
  "attemptsTotal": 3
}

// GET /api/jobs/stats response:
{
  "waiting": 2,
  "active": 1,
  "completed": 45,
  "failed": 1,
  "delayed": 0,
  "total": 49,
  "isPollingMode": true
}`}
                </pre>
              </ExpandableExample>
            </div>

            <div id="maintenance-scripts" style={{ marginBottom: '30px', scrollMarginTop: '80px' }}>
              <h3 style={{ color: 'var(--text-primary)', marginBottom: '10px', fontSize: '18px' }}>
                15. Maintenance Scripts
              </h3>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '10px' }}>
                A collection of command-line utilities for maintaining data integrity, fixing common issues, and verifying the consistency of processed routes.
              </p>
              <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '15px', borderRadius: '8px', marginBottom: '15px' }}>
                <strong style={{ color: 'var(--text-primary)' }}>Integrity Verification:</strong>
                <ul style={{ color: 'var(--text-secondary)', marginTop: '10px', paddingLeft: '20px' }}>
                  <li><strong>scripts/find-strange-stops.js</strong> - Scans all processed routes for coordinates outside the Portland metro area, missing coordinates, or missing neighborhood data.</li>
                  <li><strong>scripts/verify-school-stops.js</strong> - Ensures every route has a correctly identified school stop (<code>isSchoolStop: true</code>) with address and coordinates that exactly match the school's entry in <code>schools.json</code>.</li>
                </ul>
              </div>
              <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '15px', borderRadius: '8px', marginBottom: '15px' }}>
                <strong style={{ color: 'var(--text-primary)' }}>Data Fixes & Processing:</strong>
                <ul style={{ color: 'var(--text-secondary)', marginTop: '10px', paddingLeft: '20px' }}>
                  <li><strong>scripts/fix-strange-stops.js</strong> - Automatically fixes common data issues:
                    <ul style={{ marginTop: '5px', paddingLeft: '20px' }}>
                      <li>Sets <code>skipGeocoding: true</code> for "Loading ZONE" stops.</li>
                      <li>Removes incorrect geocoded coordinates (e.g., stops geocoded to California).</li>
                      <li>Ensures school stops have the correct <code>schoolName</code> property.</li>
                    </ul>
                  </li>
                  <li><strong>backend/scripts/recalculate-geometry.js</strong> - Recalculates the street-following geometry for all routes that are missing it or have invalid paths.</li>
                  <li><strong>backend/scripts/add-missing-schools.js</strong> - Adds missing schools to <code>schools.json</code> and geocodes them using the Google Places API.</li>
                  <li><strong>scripts/process-single-pdf.js</strong> - Re-processes a single PDF file through the full <code>RouteProcessor</code> pipeline, useful for testing fixes on specific routes.</li>
                </ul>
              </div>
              <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '15px', borderRadius: '8px' }}>
                <strong style={{ color: 'var(--text-primary)' }}>Best Practices:</strong>
                <ul style={{ color: 'var(--text-secondary)', marginTop: '10px', paddingLeft: '20px' }}>
                  <li>Run <code>verify-school-stops.js</code> after any major data import or manual correction.</li>
                  <li>Check <code>find-strange-stops.js</code> periodically to catch geocoding drift or new edge cases.</li>
                  <li>Always keep <code>schools.json</code> as the source of truth for school names, addresses, and coordinates.</li>
                  <li><strong>Frontend Name Mapping:</strong> Use <code>getSchoolDisplayName()</code> in <code>frontend/src/utils/schoolUtils.ts</code> to map shortened data names (e.g., "Lee") to full official names (e.g., "Jason Lee Elementary") for UI display only.</li>
                </ul>
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
                  <li><code>GET /api/drive/file/{'{fileId}'}</code> - Download specific file from Drive</li>
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
                  <li><code>PUT /api/data/routes/{'{routeId}'}/stops/{'{stopId}'}</code> - Update stop data</li>
                  <li><code>PUT /api/data/routes/{'{routeId}'}/geometry</code> - Update route geometry</li>
                  <li><code>GET /api/schools</code> - Get schools list (filters for schools with PDFs by default; use <code>?all=true</code> to get all schools)</li>
                  <li><code>GET /api/schools/{'{schoolId}'}</code> - Get specific school</li>
                  <li><code>POST /api/schools</code> - Create new school</li>
                  <li><code>PUT /api/schools/{'{schoolId}'}</code> - Update school</li>
                  <li><code>POST /api/schools/{'{schoolId}'}/update-address</code> - Update school address</li>
                  <li><code>POST /api/schools/batch-update-addresses</code> - Batch update school addresses</li>
                  <li><code>DELETE /api/schools/{'{schoolId}'}</code> - Delete school</li>
                  <li><code>POST /api/routes/calculate</code> - Calculate route between waypoints</li>
                  <li><code>GET /api/routes/diagnostics</code> - Get route diagnostics</li>
                  <li><code>POST /api/routes/reset-stats</code> - Reset route statistics</li>
                  <li><code>POST /api/streets/geometry</code> - Get street geometry</li>
                  <li><code>GET /api/scheduler/status</code> - Get scheduler status</li>
                  <li><code>POST /api/scheduler/toggle</code> - Toggle scheduler on/off</li>
                  <li><code>POST /api/scheduler/run-now</code> - Trigger scheduler manually</li>
                  <li><code>GET /api/verification/report</code> - Get verification report</li>
                  <li><code>POST /api/verification/verify/{'{schoolId}'}</code> - Verify specific school</li>
                  <li><code>POST /api/verification/verify-all</code> - Verify all schools</li>
                  <li><code>GET /api/pdf-status/status</code> - Get PDF status report</li>
                  <li><code>GET /api/pdfs/{'{schoolId}'}/{'{filename}'}</code> - Serve PDF file for a school</li>
                  <li><code>POST /api/pdf-sync/fetch/{'{schoolId}'}</code> - Fetch PDFs for a school</li>
                  <li><code>GET /api/pdf-sync/status/{'{schoolId}'}</code> - Get sync status for a school</li>
                  <li><code>GET /api/pdf-sync/status</code> - Get sync status for all schools</li>
                  <li><code>GET /api/process-pdfs/status</code> - Get processing status for all schools</li>
                  <li><code>POST /api/process-pdfs/process/{'{schoolId}'}</code> - Process all PDFs for a school</li>
                  <li><code>POST /api/jobs/enqueue</code> - Enqueue a new job</li>
                  <li><code>GET /api/jobs</code> - List jobs (with optional filters: jobType, status, limit)</li>
                  <li><code>GET /api/jobs/{'{jobId}'}</code> - Get job status by ID</li>
                  <li><code>POST /api/jobs/{'{jobId}'}/cancel</code> - Cancel a job</li>
                  <li><code>POST /api/jobs/{'{jobId}'}/retry</code> - Retry a failed job</li>
                  <li><code>GET /api/jobs/stats</code> - Get job queue statistics</li>
                  <li><code>GET /api/jobs/school/{'{schoolId}'}</code> - Get jobs for a specific school</li>
                  <li><code>POST /api/servers/restart</code> - Restart a server process (pps-backend or pps-frontend)</li>
                  <li><code>GET /api/servers/status/:processName</code> - Get status of a server process</li>
                  <li><code>GET /api/health</code> - Health check endpoint</li>
                </ul>
              </div>
            </div>

            <div id="frontend-routing" style={{ marginBottom: '30px', scrollMarginTop: '80px' }}>
              <h3 style={{ color: 'var(--text-primary)', marginBottom: '10px', fontSize: '18px' }}>
                2. Frontend Routing (App.tsx)
              </h3>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '10px' }}>
                Defines the application's page structure and navigation using React Router v7.
              </p>
              <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '15px', borderRadius: '8px', marginBottom: '15px' }}>
                <strong style={{ color: 'var(--text-primary)' }}>Main Routes:</strong>
                <ul style={{ color: 'var(--text-secondary)', marginTop: '10px', paddingLeft: '20px' }}>
                  <li><code>/</code> - <strong>Home Page:</strong> Landing page with address/school search.</li>
                  <li><code>/schools</code> - <strong>Explorer Map:</strong> Interactive map showing all schools (captured by catch-all).</li>
                  <li><code>/schools</code> or <code>/explore</code> - <strong>Explorer Map:</strong> Interactive map showing all schools and routes.</li>
                  <li><code>/school-directory</code> - <strong>School Directory:</strong> Searchable list of all schools.</li>
                  <li><code>/neighborhood-directory</code> - <strong>Neighborhoods:</strong> Browse by neighborhood.</li>
                  <li><code>/admin</code> - <strong>Admin Interface:</strong> School and route management.</li>
                  <li><code>/:schoolId</code> - <strong>School Routes:</strong> Explorer view for a specific school.</li>
                  <li><code>/*</code> - <strong>Explorer Catch-all:</strong> Handles path-based state for route explorer.</li>
                  <li><code>/explore</code>, <code>/bus-route-explorer</code> - <strong>Legacy Redirects:</strong> Redirects to <code>/schools</code>.</li>
                </ul>
              </div>
            </div>

            <div id="local-routes-service" style={{ marginBottom: '30px', scrollMarginTop: '80px' }}>
              <h3 style={{ color: 'var(--text-primary)', marginBottom: '10px', fontSize: '18px' }}>
                3. Local Routes Service (localRoutes.ts)
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
    "color": "#FFFFFF",
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
{`// Cache key: "google_route_cache"
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

            <div id="theme-service" style={{ marginBottom: '30px', scrollMarginTop: '80px' }}>
              <h3 style={{ color: 'var(--text-primary)', marginBottom: '10px', fontSize: '18px' }}>
                5. Theme Service
              </h3>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '10px' }}>
                Manages global dark/light mode state and ensures synchronization across all components, including the interactive map.
              </p>
              <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '15px', borderRadius: '8px' }}>
                <ul style={{ color: 'var(--text-secondary)', marginTop: '10px', paddingLeft: '20px' }}>
                  <li style={{ marginBottom: '8px' }}><strong>Centralized State:</strong> Theme state is managed in the global Zustand store to ensure all components react simultaneously to theme changes.</li>
                  <li style={{ marginBottom: '8px' }}><strong>Persistence:</strong> Selected theme is persisted in <code>localStorage</code> and automatically restored on page load.</li>
                  <li style={{ marginBottom: '8px' }}><strong>System Sync:</strong> Defaults to the user's system color scheme preference if no manual override is stored.</li>
                  <li><strong>Map Integration:</strong> The <code>DarkModeTileLayer</code> component listens to the global theme state to instantly swap between Light and Dark map tile sets.</li>
                </ul>
              </div>
            </div>

            <div id="global-store" style={{ marginBottom: '30px', scrollMarginTop: '80px' }}>
              <h3 style={{ color: 'var(--text-primary)', marginBottom: '10px', fontSize: '18px' }}>
                7. Global Store (Zustand)
              </h3>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '10px' }}>
                Manages all application state and provides debounced caching for route updates.
              </p>
              <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '15px', borderRadius: '8px' }}>
                <ul style={{ color: 'var(--text-secondary)', marginTop: '10px', paddingLeft: '20px' }}>
                  <li style={{ marginBottom: '8px' }}><strong>Atomic Updates:</strong> Uses synchronous state updates to prevent race conditions during complex operations.</li>
                  <li style={{ marginBottom: '8px' }}><strong>Debounced Caching:</strong> Implements a 250ms debounced cache write mechanism to handle bulk updates (like geocoding) without redundant <code>localStorage</code> operations.</li>
                  <li><strong>Centralized Logic:</strong> Encapsulates color assignment, route selection, and direction filtering logic in a single location.</li>
                </ul>
              </div>
            </div>

            <div id="pwa-support" style={{ marginBottom: '30px', scrollMarginTop: '80px' }}>
              <h3 style={{ color: 'var(--text-primary)', marginBottom: '10px', fontSize: '18px' }}>
                8. PWA & Home Screen Support
              </h3>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '10px' }}>
                The application supports Progressive Web App (PWA) features for a "native-like" experience when saved to a device's home screen.
              </p>
              <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '15px', borderRadius: '8px' }}>
                <ul style={{ color: 'var(--text-secondary)', marginTop: '10px', paddingLeft: '20px' }}>
                  <li style={{ marginBottom: '8px' }}><strong>Web App Manifest:</strong> <code>frontend/public/manifest.json</code> defines the app's name, icons, and display mode (standalone).</li>
                  <li style={{ marginBottom: '8px' }}><strong>iOS Integration:</strong> Uses <code>apple-touch-icon</code> and specific meta tags (<code>apple-mobile-web-app-capable</code>) for optimal performance on iOS devices.</li>
                  <li style={{ marginBottom: '8px' }}><strong>Status Bar Management:</strong> Uses <code>default</code> status bar style combined with dynamic <code>theme-color</code> updates to ensure the system status bar background matches the app's header color perfectly across both Light and Dark modes.</li>
                  <li style={{ marginBottom: '8px' }}><strong>Dynamic Theme Tints:</strong> The <code>theme-color</code> meta tag is updated dynamically in <code>App.tsx</code> whenever the dark mode state changes, forcing Safari to re-tint the browser UI to match the application's current theme.</li>
                  <li style={{ marginBottom: '8px' }}><strong>Icons:</strong> High-resolution <code>apple-touch-icon.png</code> (180x180) provided in the public directory.</li>
                  <li><strong>Viewport Fit:</strong> Uses <code>viewport-fit=cover</code> to ensure the application utilizes the full screen on "notched" devices.</li>
                </ul>
              </div>
            </div>
          </section>

          <section id="url-state-sync" style={{ marginBottom: '40px', scrollMarginTop: '80px' }}>
            <h2 style={{ color: 'var(--text-primary)', marginBottom: '20px', fontSize: '24px' }}>
              URL & State Synchronization
            </h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '20px' }}>
              The application maintains a bidirectional synchronization between the complex UI state and the browser URL. 
              This ensures that the exact view—including selected school, tab, direction filter, multiple route selections, 
              and even a focused stop—is always bookmarkable and shareable.
            </p>

            <div id="url-schema" style={{ marginBottom: '30px', scrollMarginTop: '80px' }}>
              <h3 style={{ color: 'var(--text-primary)', marginBottom: '10px', fontSize: '18px' }}>
                1. URL Schema & Hierarchy
              </h3>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '10px' }}>
                The application uses a nested, hierarchical URL structure where the <code>schoolId</code> is the primary key.
              </p>
              <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '15px', borderRadius: '8px' }}>
                <ul style={{ color: 'var(--text-secondary)', listStyleType: 'none', paddingLeft: 0 }}>
                  <li style={{ marginBottom: '10px' }}><strong>Schools Index:</strong> <code>/schools</code></li>
                  <li style={{ marginBottom: '10px' }}><strong>Selected School:</strong> <code>/{'{schoolId}'}</code></li>
                  <li style={{ marginBottom: '10px' }}><strong>Routes View:</strong> <code>/{'{schoolId}'}/routes</code></li>
                  <li style={{ marginBottom: '10px' }}><strong>Direction Filter:</strong> <code>/{'{schoolId}'}/routes/morning</code></li>
                  <li style={{ marginBottom: '10px' }}><strong>Selected Routes:</strong> <code>/{'{schoolId}'}/routes/morning/238,254</code></li>
                  <li><strong>Focused Stop:</strong> <code>/{'{schoolId}'}/routes/morning/238,254/254-1</code></li>
                </ul>
              </div>
            </div>

            <div id="ui-url-interactions" style={{ marginBottom: '30px', scrollMarginTop: '80px' }}>
              <h3 style={{ color: 'var(--text-primary)', marginBottom: '10px', fontSize: '18px' }}>
                2. UI-to-URL Interactions
              </h3>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '10px' }}>
                Every state-changing user interaction is mirrored in the URL to ensure consistency.
              </p>
              <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '15px', borderRadius: '8px' }}>
                <ul style={{ color: 'var(--text-secondary)', marginTop: '10px', paddingLeft: '20px' }}>
                  <li style={{ marginBottom: '8px' }}><strong>School Selection:</strong> Clicking a school in the list or a pin on the map updates the URL to <code>/{'{schoolId}'}</code>.</li>
                  <li style={{ marginBottom: '8px' }}><strong>Tab Switching:</strong> Switching between "Schools" and "Routes" tabs toggles the <code>/routes</code> segment.</li>
                  <li style={{ marginBottom: '8px' }}><strong>Route Toggling:</strong> Selecting/deselecting routes in the list updates the comma-separated route names segment.</li>
                  <li style={{ marginBottom: '8px' }}><strong>Direction Filter:</strong> Toggling "Morning", "Afternoon", or "Both" updates the direction segment.</li>
                  <li style={{ marginBottom: '8px' }}><strong>Stop Selection:</strong> Clicking a bus stop adds the <code>{'{routeName}-{stopNumber}'}</code> identifier to the end of the URL.</li>
                  <li><strong>Deselection:</strong> Closing a dialog (school or stop) removes the corresponding segment from the URL, moving the user "up" the hierarchy.</li>
                </ul>
              </div>
            </div>

            <div id="url-to-ui-restoration" style={{ marginBottom: '30px', scrollMarginTop: '80px' }}>
              <h3 style={{ color: 'var(--text-primary)', marginBottom: '10px', fontSize: '18px' }}>
                3. URL-to-UI Restoration (The Sync Loop)
              </h3>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '10px' }}>
                When a user visits a direct URL, the application performs a multi-stage sync to restore the UI state.
              </p>
              <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '15px', borderRadius: '8px' }}>
                <ol style={{ color: 'var(--text-secondary)', marginTop: '10px', paddingLeft: '20px' }}>
                  <li style={{ marginBottom: '8px' }}><strong>Initial Parse:</strong> The <code>parseUrlPath</code> utility extracts the school, tab, direction, routes, and stop.</li>
                  <li style={{ marginBottom: '8px' }}><strong>School Load:</strong> If a <code>schoolId</code> is present, it is selected immediately.</li>
                  <li style={{ marginBottom: '8px' }}><strong>Pre-Selection:</strong> Before routes are even set in the store, <code>applyUrlStateToRoutes</code> calculates their initial <code>isSelected</code> state based on the URL. This prevents the "select all" flicker.</li>
                  <li style={{ marginBottom: '8px' }}><strong>Strict Selection:</strong> If the URL contains specific route names, ONLY those routes are selected for the current direction.</li>
                  <li style={{ marginBottom: '8px' }}><strong>Default "Select All":</strong> If the user navigates to <code>/routes</code> without specific route names, the app defaults to selecting all routes for the current direction.</li>
                  <li><strong>Stop Highlighting:</strong> Once routes are loaded, the app searches for the stop matching <code>{'{routeName}-{stopNumber}'}</code> and selects it, triggering the zoom behavior.</li>
                </ol>
              </div>
            </div>

            <div id="context-aware-navigation" style={{ marginBottom: '30px', scrollMarginTop: '80px' }}>
              <h3 style={{ color: 'var(--text-primary)', marginBottom: '10px', fontSize: '18px' }}>
                4. Context-Aware Navigation
              </h3>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '10px' }}>
                The application logic adapts its behavior based on the current tab and device context.
              </p>
              <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '15px', borderRadius: '8px' }}>
                <ul style={{ color: 'var(--text-secondary)', marginTop: '10px', paddingLeft: '20px' }}>
                  <li style={{ marginBottom: '8px' }}><strong>Preserving School Context:</strong> Closing the school info dialog while in the "Routes" tab will <em>not</em> deselect the school. This prevents the user from being kicked back to the schools index unintentionally.</li>
                  <li style={{ marginBottom: '8px' }}><strong>Clean Tab Transitions:</strong> Clicking "View Routes" from a school dialog explicitly clears any previously selected stop to ensure the map zooms out to show all routes for that school.</li>
                  <li style={{ marginBottom: '8px' }}><strong>Direction Switching:</strong> When switching from Morning to Afternoon, the app attempts to preserve the current stop selection by matching the street address in the new direction's route.</li>
                  <li style={{ marginBottom: '8px' }}><strong>Mobile Optimization:</strong> Selecting a school from the sidebar on mobile devices automatically closes the sidebar to maximize map visibility.</li>
                  <li style={{ marginBottom: '8px' }}><strong>Generic Entry Points:</strong> Clicking "Explore Map" from the homepage or neighborhood directory explicitly clears any existing school or route selection to ensure the user starts with a clean "Show All Schools" view.</li>
                  <li><strong>Viewport Stability:</strong> To prevent mobile Safari from shifting the UI when toolbars resize or when the URL changes (e.g., toggling routes), the app uses <code>100dvh</code> (Dynamic Viewport Height) and locks the main container with <code>position: fixed</code> and <code>window.scrollTo(0, 0)</code> resets.</li>
                </ul>
              </div>
            </div>

            <div id="state-logic-rules" style={{ marginBottom: '30px', scrollMarginTop: '80px' }}>
              <h3 style={{ color: 'var(--text-primary)', marginBottom: '10px', fontSize: '18px' }}>
                5. Critical State Rules
              </h3>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '10px' }}>
                To prevent infinite loops and race conditions, the sync logic follows these strict rules:
              </p>
              <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '15px', borderRadius: '8px' }}>
                <ul style={{ color: 'var(--text-secondary)', marginTop: '10px', paddingLeft: '20px' }}>
                  <li style={{ marginBottom: '8px' }}><strong>Atomic Updates:</strong> Route selections are updated in a single store action (<code>setSelectedRoutes</code>) rather than multiple individual toggles.</li>
                  <li style={{ marginBottom: '8px' }}><strong>Direction Awareness:</strong> Route selections in the URL only affect the <em>current</em> direction filter. Selections in the "other" direction are preserved in the background state.</li>
                  <li style={{ marginBottom: '8px' }}><strong>Navigation Locking:</strong> A <code>isNavigatingRef</code> flag prevents the app from re-syncing from the URL while it is in the middle of updating the URL from a user action.</li>
                  <li><strong>Upcoming Route Handling:</strong> Routes with future effective dates are identified by their <code>effectiveDate</code> property. In the URL, their stops use an <code>-upcoming</code> suffix to distinguish them from current routes (e.g., <code>104/104-1-upcoming</code>).</li>
                </ul>
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
              <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '15px', borderRadius: '8px', marginBottom: '15px' }}>
                <strong style={{ color: 'var(--text-primary)' }}>Note:</strong>
                <ul style={{ color: 'var(--text-secondary)', marginTop: '10px', paddingLeft: '20px' }}>
                  <li><code>geometry</code> - Street-following route path as array of <code>[lat, lng]</code> coordinates (for Leaflet). Optional, calculated when route is processed.</li>
                  <li><code>fileId</code> - Google Drive file ID of the source PDF</li>
                  <li><code>modifiedTime</code> - Last modified time of the PDF file in Google Drive</li>
                  <li><code>isSchoolStop</code> - Indicates if stop is the school loading zone (added automatically from schools.json)</li>
                  <li><code>schoolName</code> - Name of school (only present on school stops)</li>
                </ul>
              </div>
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
  "fileId": "1a2b3c4d5e6f7g8h9i0j",
  "modifiedTime": "2024-01-20T08:00:00.000Z",
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
    },
    {
      "id": "stop-0",
      "address": "1301 SW 25th Ave, Portland, OR 97201",
      "coordinates": [-122.6984, 45.5123],
      "displayName": "1301 SW 25th Ave, Portland, OR 97201",
      "time": null,
      "direction": null,
      "originalLine": "Anchor Name:WEST SYLVAN GT LOADING ZONE IN DRIVEWAY",
      "isSchoolStop": true,
      "schoolName": "West Sylvan",
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
  },
  "geometry": [
    [45.5152, -122.6784],
    [45.5153, -122.6785],
    [45.5154, -122.6786]
  ],
  "geometryUpdatedAt": "2024-01-20T10:35:00.000Z"
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
├── verification-report.json        # School link verification report
├── pdf-status.json                 # PDF status report
├── pdf-sync-status.json            # PDF sync status for all schools
├── jobs/                            # Job queue data (Redis or in-memory)
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

          <section id="analytics-instrumentation" style={{ marginBottom: '40px', scrollMarginTop: '80px' }}>
            <h2 style={{ color: 'var(--text-primary)', marginBottom: '20px', fontSize: '24px' }}>
              Analytics & Instrumentation
            </h2>
            
            <div id="ga4-setup" style={{ marginBottom: '30px', scrollMarginTop: '80px' }}>
              <h3 style={{ color: 'var(--text-primary)', marginBottom: '10px', fontSize: '18px' }}>
                1. GA4 Setup & Service
              </h3>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '10px' }}>
                The application uses Google Analytics 4 (GA4) via the <code>react-ga4</code> library. Instrumentation is handled by a centralized <code>AnalyticsService</code>.
              </p>
              <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '15px', borderRadius: '8px' }}>
                <ul style={{ color: 'var(--text-secondary)', marginTop: '10px', paddingLeft: '20px' }}>
                  <li style={{ marginBottom: '8px' }}><strong>Service:</strong> <code>frontend/src/services/analytics.ts</code></li>
                  <li style={{ marginBottom: '8px' }}><strong>Environment Variable:</strong> <code>VITE_GA_TRACKING_ID</code></li>
                  <li><strong>Initialization:</strong> Occurs in the root <code>App</code> component on mount.</li>
                </ul>
              </div>
            </div>

            <div id="event-tracking" style={{ marginBottom: '30px', scrollMarginTop: '80px' }}>
              <h3 style={{ color: 'var(--text-primary)', marginBottom: '10px', fontSize: '18px' }}>
                2. Event Tracking Schema
              </h3>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '10px' }}>
                Key user interactions are instrumented with custom events:
              </p>
              <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '15px', borderRadius: '8px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', color: 'var(--text-secondary)', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'left' }}>
                      <th style={{ padding: '8px', color: 'var(--text-primary)' }}>Category</th>
                      <th style={{ padding: '8px', color: 'var(--text-primary)' }}>Action</th>
                      <th style={{ padding: '8px', color: 'var(--text-primary)' }}>Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '8px' }}>Search</td>
                      <td style={{ padding: '8px' }}>address_search</td>
                      <td style={{ padding: '8px' }}>Tracked when a user selects an address from autocomplete.</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '8px' }}>Selection</td>
                      <td style={{ padding: '8px' }}>school_select</td>
                      <td style={{ padding: '8px' }}>Tracked when a school is selected from the list or map.</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '8px' }}>Selection</td>
                      <td style={{ padding: '8px' }}>route_select/deselect</td>
                      <td style={{ padding: '8px' }}>Tracked when a bus route is toggled in the explorer.</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '8px' }}>Navigation</td>
                      <td style={{ padding: '8px' }}>tab_change</td>
                      <td style={{ padding: '8px' }}>Tracked when switching between Schools and Routes tabs.</td>
                    </tr>
                    <tr>
                      <td style={{ padding: '8px' }}>Admin</td>
                      <td style={{ padding: '8px' }}>pdf_sync / drive_check</td>
                      <td style={{ padding: '8px' }}>Tracked when administrative actions are performed.</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div id="page-view-tracking" style={{ marginBottom: '30px', scrollMarginTop: '80px' }}>
              <h3 style={{ color: 'var(--text-primary)', marginBottom: '10px', fontSize: '18px' }}>
                3. Page View Tracking
              </h3>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '10px' }}>
                Automatic page view tracking is implemented using the <code>usePageTracking</code> hook, which listens to <code>react-router-dom</code> location changes.
              </p>
              <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '15px', borderRadius: '8px' }}>
                <code style={{ color: 'var(--text-primary)' }}>frontend/src/hooks/usePageTracking.ts</code>
              </div>
            </div>
          </section>

          <section id="seo-discovery" style={{ marginBottom: '40px', scrollMarginTop: '80px' }}>
            <h2 style={{ color: 'var(--text-primary)', marginBottom: '20px', fontSize: '24px' }}>
              Discovery & SEO
            </h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '30px' }}>
              The application implements technical SEO to ensure bus routes and school information are discoverable by search engines.
            </p>

            <div id="meta-tags-management" style={{ marginBottom: '30px', scrollMarginTop: '80px' }}>
              <h3 style={{ color: 'var(--text-primary)', marginBottom: '10px', fontSize: '18px' }}>
                1. Meta Tags Management (SEO.tsx)
              </h3>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '10px' }}>
                Dynamic meta tags (title, description, Open Graph, Twitter Card) are managed using <code>react-helmet-async</code>.
              </p>
              <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '15px', borderRadius: '8px' }}>
                <ul style={{ color: 'var(--text-secondary)', marginTop: '10px', paddingLeft: '20px' }}>
                  <li style={{ marginBottom: '8px' }}><strong>Component:</strong> <code>frontend/src/components/SEO.tsx</code></li>
                  <li style={{ marginBottom: '8px' }}><strong>Home Page:</strong> Static title "Find Your Stop" and specific description.</li>
                  <li style={{ marginBottom: '8px' }}><strong>Explorer Page:</strong> Hierarchical dynamic titles:
                    <ul style={{ marginTop: '5px', paddingLeft: '20px' }}>
                      <li><strong>Stop Selection:</strong> "Stop at [Address] | Route [Name] | [School]"</li>
                      <li><strong>Route Selection:</strong> "Route [Names] | [School]"</li>
                      <li><strong>School Focus:</strong> "[School Name] Bus Routes"</li>
                    </ul>
                  </li>
                  <li><strong>Social Compatibility:</strong> Uses absolute URLs for Open Graph (og:image) and Twitter images to ensure correct display on social platforms.</li>
                </ul>
              </div>
            </div>

            <div id="robots-txt" style={{ marginBottom: '30px', scrollMarginTop: '80px' }}>
              <h3 style={{ color: 'var(--text-primary)', marginBottom: '10px', fontSize: '18px' }}>
                2. Robots.txt
              </h3>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '10px' }}>
                A <code>robots.txt</code> file guides search engine crawlers on which paths to index.
              </p>
              <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '15px', borderRadius: '8px' }}>
                <code style={{ color: 'var(--text-primary)' }}>frontend/public/robots.txt</code>
              </div>
            </div>

            <div id="sitemap-generation" style={{ marginBottom: '30px', scrollMarginTop: '80px' }}>
              <h3 style={{ color: 'var(--text-primary)', marginBottom: '10px', fontSize: '18px' }}>
                3. Sitemap Generation
              </h3>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '10px' }}>
                A script automatically generates a <code>sitemap.xml</code> file containing all school-specific routes.
              </p>
              <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '15px', borderRadius: '8px' }}>
                <ul style={{ color: 'var(--text-secondary)', marginTop: '10px', paddingLeft: '20px' }}>
                  <li style={{ marginBottom: '8px' }}><strong>Script:</strong> <code>scripts/generate-sitemap.js</code></li>
                  <li><strong>Output:</strong> <code>frontend/public/sitemap.xml</code></li>
                </ul>
              </div>
            </div>
          </section>

          <section id="deployment" style={{ marginBottom: '40px', scrollMarginTop: '80px' }}>
            <h2 style={{ color: 'var(--text-primary)', marginBottom: '20px', fontSize: '24px' }}>
              Deployment
            </h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '30px' }}>
              The application uses a centralized deployment script to ensure consistent and reliable updates across environments.
            </p>

            <div id="deployment-script" style={{ marginBottom: '30px', scrollMarginTop: '80px' }}>
              <h3 style={{ color: 'var(--text-primary)', marginBottom: '10px', fontSize: '18px' }}>
                1. Deployment Script (deploy.sh)
              </h3>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '10px' }}>
                The <code>deploy.sh</code> script at the project root orchestrates the entire deployment pipeline.
              </p>
              <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '15px', borderRadius: '8px' }}>
                <ul style={{ color: 'var(--text-secondary)', marginTop: '10px', paddingLeft: '20px' }}>
                  <li style={{ marginBottom: '8px' }}><strong>Path:</strong> <code>deploy.sh</code></li>
                  <li style={{ marginBottom: '8px' }}><strong>Permissions:</strong> Must be executable (<code>chmod +x deploy.sh</code>)</li>
                  <li><strong>Command:</strong> <code>./deploy.sh</code></li>
                </ul>
              </div>
            </div>

            <div id="deployment-process" style={{ marginBottom: '30px', scrollMarginTop: '80px' }}>
              <h3 style={{ color: 'var(--text-primary)', marginBottom: '10px', fontSize: '18px' }}>
                2. Deployment Process
              </h3>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '10px' }}>
                When executed, the deployment script follows these steps:
              </p>
              <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '15px', borderRadius: '8px' }}>
                <ol style={{ color: 'var(--text-secondary)', marginTop: '10px', paddingLeft: '20px' }}>
                  <li style={{ marginBottom: '8px' }}><strong>Stop Servers:</strong> Identifies and kills running <code>node server.js</code> processes.</li>
                  <li style={{ marginBottom: '8px' }}><strong>Pull Latest:</strong> Fetches and pulls the latest changes from <code>origin main</code>.</li>
                  <li style={{ marginBottom: '8px' }}><strong>Build Frontend:</strong> Runs <code>npm run build</code> in the <code>frontend/</code> directory.</li>
                  <li style={{ marginBottom: '8px' }}><strong>Start Servers:</strong> Launches the production server using <code>npm run start:production</code>.</li>
                  <li><strong>Verification:</strong> Confirms the server is running and responding to API calls.</li>
                </ol>
              </div>
              <p style={{ color: 'var(--text-secondary)', marginTop: '20px' }}>
                <strong>Logs:</strong> Build logs are written to <code>logs/build.log</code> and server runtime logs to <code>logs/server.log</code>.
              </p>
            </div>
          </section>

          <section id="testing-infrastructure" style={{ marginBottom: '40px', scrollMarginTop: '80px' }}>
            <h2 style={{ color: 'var(--text-primary)', marginBottom: '20px', fontSize: '24px' }}>
              Testing Infrastructure
            </h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '30px' }}>
              The project uses a multi-layered testing approach to ensure reliability of both backend logic and frontend components.
            </p>

            <div id="backend-testing" style={{ marginBottom: '30px', scrollMarginTop: '80px' }}>
              <h3 style={{ color: 'var(--text-primary)', marginBottom: '10px', fontSize: '18px' }}>
                1. Backend Testing (Node --test)
              </h3>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '10px' }}>
                Backend tests use the native Node.js test runner (available in Node 18+). This provides a fast, zero-dependency testing environment.
              </p>
              <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '15px', borderRadius: '8px' }}>
                <ul style={{ color: 'var(--text-secondary)', marginTop: '10px', paddingLeft: '20px' }}>
                  <li style={{ marginBottom: '8px' }}><strong>Location:</strong> <code>backend/tests/*.test.js</code></li>
                  <li style={{ marginBottom: '8px' }}><strong>Runner:</strong> <code>node --test</code></li>
                  <li style={{ marginBottom: '8px' }}><strong>Assertions:</strong> Native <code>node:assert</code></li>
                  <li><strong>Focus:</strong> Utility functions, API services, and data processing logic.</li>
                </ul>
              </div>
            </div>

            <div id="frontend-testing" style={{ marginBottom: '30px', scrollMarginTop: '80px' }}>
              <h3 style={{ color: 'var(--text-primary)', marginBottom: '10px', fontSize: '18px' }}>
                2. Frontend Testing (Vitest)
              </h3>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '10px' }}>
                Frontend tests use Vitest, a Vite-native testing framework that is significantly faster than Jest and shares configuration with the build system.
              </p>
              <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '15px', borderRadius: '8px' }}>
                <ul style={{ color: 'var(--text-secondary)', marginTop: '10px', paddingLeft: '20px' }}>
                  <li style={{ marginBottom: '8px' }}><strong>Location:</strong> <code>frontend/src/**/*.test.ts</code> or <code>.tsx</code></li>
                  <li style={{ marginBottom: '8px' }}><strong>Libraries:</strong> Vitest, React Testing Library, jsdom</li>
                  <li style={{ marginBottom: '8px' }}><strong>Setup:</strong> <code>frontend/src/test/setup.ts</code></li>
                  <li><strong>Focus:</strong> Component rendering, UI logic, and frontend utilities.</li>
                </ul>
              </div>
            </div>

            <div id="build-verification" style={{ marginBottom: '30px', scrollMarginTop: '80px' }}>
              <h3 style={{ color: 'var(--text-primary)', marginBottom: '10px', fontSize: '18px' }}>
                3. Build & Type Verification
              </h3>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '10px' }}>
                To ensure code quality and prevent runtime errors, the project includes static type checking and build verification.
              </p>
              <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '15px', borderRadius: '8px' }}>
                <ul style={{ color: 'var(--text-secondary)', marginTop: '10px', paddingLeft: '20px' }}>
                  <li style={{ marginBottom: '8px' }}><strong>Type Checking:</strong> <code>tsc --noEmit</code> verifies all TypeScript types in the frontend without generating files.</li>
                  <li style={{ marginBottom: '8px' }}><strong>Build Test:</strong> The <code>npm run build</code> command is verified to ensure Vite can successfully bundle the application.</li>
                  <li><strong>Integration:</strong> Type checking is integrated into the main <code>npm test</code> command.</li>
                </ul>
              </div>
            </div>

            <div id="running-tests" style={{ marginBottom: '30px', scrollMarginTop: '80px' }}>
              <h3 style={{ color: 'var(--text-primary)', marginBottom: '10px', fontSize: '18px' }}>
                4. Running Tests
              </h3>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '10px' }}>
                Tests can be run individually by package or collectively from the root.
              </p>
              <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '15px', borderRadius: '8px', fontFamily: 'monospace' }}>
                <div style={{ marginBottom: '10px', color: 'var(--text-primary)' }}># Run all tests (Backend, Frontend, Types)</div>
                <div style={{ color: 'var(--text-secondary)', marginBottom: '15px' }}>npm test</div>
                
                <div style={{ marginBottom: '10px', color: 'var(--text-primary)' }}># Backend only</div>
                <div style={{ color: 'var(--text-secondary)', marginBottom: '15px' }}>npm run test:backend</div>
                
                <div style={{ marginBottom: '10px', color: 'var(--text-primary)' }}># Frontend only</div>
                <div style={{ color: 'var(--text-secondary)', marginBottom: '15px' }}>npm run test:frontend</div>

                <div style={{ marginBottom: '10px', color: 'var(--text-primary)' }}># Type check only</div>
                <div style={{ color: 'var(--text-secondary)' }}>npm run test:types</div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
