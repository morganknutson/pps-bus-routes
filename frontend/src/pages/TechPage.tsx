import { useState, useEffect, useRef } from 'react';
import { Header } from '../components/Header';
import { Sidebar } from '../components/Sidebar';
import { SEO } from '../components/SEO';
import { ExpandableExample } from '../components/ExpandableExample';
import { RouteListBase } from '../components/RouteListBase';
import { SchoolList } from '../components/SchoolList';
import { RouteIcon } from '../components/RouteIcon';
import { Route, School, Stop } from '../types';
import { exampleSchool, exampleSchools, exampleStop, exampleRoute } from '../utils/dummyData';
import { MapContainer, Marker, Polyline } from 'react-leaflet';
import { DarkModeTileLayer } from '../components/DarkModeTileLayer';
import { createSchoolIcon, createNumberedIcon } from '../utils/markerIcons';
import { SchoolInfoTooltip } from '../components/SchoolInfoTooltip';
import { StopInfoTooltip } from '../components/StopInfoTooltip';
import { MapPinIcon } from '../components/MapPinIcon';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface Section {
  id: string;
  title: string;
  subsections?: { id: string; title: string; isHighlighted?: boolean }[];
}

const sections: Section[] = [
  {
    id: 'find-my-stop',
    title: 'Find My Stop (The Explorer)',
    subsections: [
      { id: 'school-explorer', title: '1. School Explorer (Discovery)' },
      { id: 'route-explorer', title: '2. Route Explorer (Detail)' },
      { id: 'address-lookup', title: '3. Address Search & Autocomplete' },
      { id: 'assigned-schools', title: '4. Assigned Schools Lookup' },
      { id: 'neighborhood-explorer', title: '5. Neighborhood Directory' },
    ],
  },
  {
    id: 'map-interface',
    title: 'Map Components & UI',
    subsections: [
      { id: 'school-pins', title: '1. School Pins & Icons' },
      { id: 'stop-pins', title: '2. Stop Pins & Numbering' },
      { id: 'route-lines', title: '3. Route Polylines (Street Geometry)' },
      { id: 'info-dialogs', title: '4. Tooltips & Info Panels' },
      { id: 'advanced-map-interactions', title: '5. Advanced Interactions (Undo & Pins)' },
    ],
  },
  {
    id: 'data-pipeline',
    title: 'Under the Hood: Data Flow',
    subsections: [
      { id: 'drive-sync', title: '1. Google Drive Sync' },
      { id: 'pdf-processing', title: '2. PDF Processing & Extraction' },
      { id: 'geocoding-logic', title: '3. Address Geocoding' },
      { id: 'url-state', title: '4. URL Deep Linking & State' },
      { id: 'walking-distance-matrix', title: '5. Walking Distance Matrix' },
      { id: 'performance-optimization', title: '6. Performance & Loading State' },
    ],
  },
  {
    id: 'design-ops',
    title: 'Design System & Operations',
    subsections: [
      { id: 'themes', title: '1. Themes (Dark/Light)' },
      { id: 'icons-typography', title: '2. Icons & Typography' },
      { id: 'analytics', title: '3. Analytics & Usage' },
      { id: 'seo', title: '4. SEO & Discovery' },
    ],
  },
  {
    id: 'engineering-ops',
    title: 'Operations & Reliability',
    subsections: [
      { id: 'autocomplete-geocoding', title: '1. Autocomplete & Geocoding' },
      { id: 'backend-performance', title: '2. Backend Performance & Stability', isHighlighted: true },
      { id: 'deployment', title: '3. Deployment Pipeline' },
      { id: 'testing', title: '4. Testing Infrastructure' },
      { id: 'file-structure', title: '5. Project Organization' },
      { id: 'maintenance', title: '6. Maintenance & Jobs' },
    ],
  },
  {
    id: 'data-examples',
    title: 'Data Schemas & Examples',
    subsections: [
      { id: 'processed-route-example', title: 'Processed Route Example' },
      { id: 'school-entry-example', title: 'School Entry Example' },
      { id: 'neighborhood-data-example', title: 'Neighborhood Data Example' },
    ],
  },
];

// UI Preview Components for Documentation
const MapPinPreview = ({ type, color = '#3b82f6', isSelected = false, isHover = false, state = 'Default' }: { type: 'school' | 'stop', color?: string, isSelected?: boolean, isHover?: boolean, state?: string }) => {
  const [map, setMap] = useState<L.Map | null>(null);
  const center: [number, number] = [45.5152, -122.6784];
  
  // Use a predictable ID for the preview markers to target them with CSS
  const previewId = `preview-${type}-${state.replace(/\s+/g, '-').toLowerCase()}`;
  const icon = type === 'school' 
    ? createSchoolIcon(color) 
    : createNumberedIcon(5, color, '8:30 am', isSelected, false, previewId);

  useEffect(() => {
    if (map) {
      map.flyTo(L.latLng(center[0], center[1]), 15, { duration: 1 });
    }
  }, [map, isSelected]);

  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center', 
      gap: '8px',
      width: '140px'
    }}>
      <div 
        style={{ 
          width: '140px', 
          height: '140px', 
          borderRadius: '16px', 
          overflow: 'hidden', 
          border: '1px solid var(--border-color)',
          position: 'relative',
          backgroundColor: 'var(--bg-secondary)',
          boxShadow: 'var(--shadow-large)'
        }}
      >
        <MapContainer
          center={center}
          zoom={15}
          style={{ height: '100%', width: '100%' }}
          zoomControl={false}
          attributionControl={false}
          dragging={false}
          touchZoom={false}
          scrollWheelZoom={false}
          doubleClickZoom={false}
          ref={setMap}
        >
          <DarkModeTileLayer />
          <Marker position={center} icon={icon} />
        </MapContainer>
        
        {/* Force hover state visuals for the "Hover State" preview */}
        {isHover && (
          <style>{`
            .numbered-marker-wrapper-${previewId} .numbered-marker-lens-${previewId} {
              left: 5px !important;
              width: 6px !important;
              height: 6px !important;
              background-color: white !important;
              box-shadow: 0 1px 1px rgba(0,0,0,0.6), 0 0 2px rgba(255,255,255,0.8) !important;
            }
            .numbered-marker-wrapper-${previewId} .numbered-marker-number-${previewId} {
              opacity: 0 !important;
            }
            .numbered-marker-wrapper-${previewId} .numbered-marker-time-${previewId} {
              opacity: 0.9 !important;
              transform: translateY(-50%) translateX(2px) !important;
            }
          `}</style>
        )}
      </div>
      <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600, textAlign: 'center', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {state}
      </span>
    </div>
  );
};

// Full Route Map Preview
const FullRoutePreview = ({ route }: { route: Route }) => {
  const [map, setMap] = useState<L.Map | null>(null);
  const stopsWithCoords = route.stops.filter(s => s.coordinates);
  
  useEffect(() => {
    if (map && stopsWithCoords.length > 0) {
      const bounds = L.latLngBounds(stopsWithCoords.map(s => [s.coordinates![1], s.coordinates![0]]));
      map.flyToBounds(bounds, { padding: [20, 20], duration: 1 });
    }
  }, [map, route]);

  return (
    <div style={{ 
      width: '100%', 
      height: '300px', 
      borderRadius: '16px', 
      overflow: 'hidden', 
      border: '1px solid var(--border-color)',
      position: 'relative',
      marginBottom: '20px',
      boxShadow: 'var(--shadow-large)'
    }}>
      <MapContainer
        center={[45.5152, -122.6784]}
        zoom={13}
        style={{ height: '100%', width: '100%' }}
        zoomControl={false}
        attributionControl={false}
        ref={setMap}
      >
        <DarkModeTileLayer />
        {route.geometry && (
          <Polyline 
            positions={route.geometry} 
            color={route.color} 
            weight={4} 
            opacity={0.8} 
          />
        )}
        {stopsWithCoords.map((stop, i) => {
          const isSchool = stop.isSchoolStop;
          const icon = isSchool 
            ? createSchoolIcon(route.color) 
            : createNumberedIcon(i + 1, route.color, stop.time, false, false, `full-route-stop-${i}`);
          return (
            <Marker 
              key={stop.id} 
              position={[stop.coordinates![1], stop.coordinates![0]]} 
              icon={icon} 
            />
          );
        })}
      </MapContainer>
    </div>
  );
};

// Replicate Actual Address Input UI
const AddressInputUIPreview = () => (
  <div style={{ marginBottom: '20px', maxWidth: '100%', position: 'relative' }}>
    <div style={{ 
      display: 'flex',
      gap: '0.75rem',
      alignItems: 'center',
    }}>
      <div style={{ 
        flex: 1,
        padding: '0 0.75rem 0 1.25rem',
        height: '40px',
        display: 'flex',
        alignItems: 'center',
        backgroundColor: 'var(--bg-tertiary)',
        borderRadius: '9999px',
        boxShadow: '0 4px 12px var(--shadow-large)',
        border: '1px solid var(--border-color)'
      }}>
        <div style={{ position: 'relative', flex: 1, height: '100%', display: 'flex', alignItems: 'center' }}>
          <i className="fas fa-house" style={{ position: 'absolute', left: '4px', top: '50%', transform: 'translateY(-50%)', fontSize: '11px', color: 'var(--text-tertiary)' }}></i>
          <div style={{ padding: '0 0.5rem 0 1.5rem', fontSize: '12px', color: 'var(--text-secondary)' }}>
            123 SW Main St...
          </div>
        </div>
      </div>
      <div style={{
        padding: '0 1.25rem',
        height: '40px',
        backgroundColor: 'var(--bg-tertiary)',
        color: 'var(--text-primary)',
        borderRadius: '9999px',
        fontSize: '12px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 4px 12px var(--shadow-large)',
        border: '1px solid var(--border-color)'
      }}>
        <MapPinIcon style={{ marginRight: '0.5rem' }} />
        <span>Find My Stop</span>
      </div>
    </div>
    
    {/* Autocomplete Dropdown Preview */}
    <div style={{
      marginTop: '8px',
      backgroundColor: 'var(--bg-primary)',
      border: '1px solid var(--border-color)',
      borderRadius: '16px',
      boxShadow: '0 4px 16px var(--shadow-hover)',
      overflow: 'hidden',
      maxWidth: '400px'
    }}>
      {[
        { name: '123 SW Main St', sub: 'Portland, OR 97204' },
        { name: '1234 NE Glisan St', sub: 'Portland, OR 97232' }
      ].map((item, i) => (
        <div key={i} style={{ 
          padding: '12px 16px', 
          borderBottom: i === 0 ? '1px solid var(--border-color)' : 'none',
          backgroundColor: i === 0 ? 'var(--bg-tertiary)' : 'transparent',
          display: 'flex',
          alignItems: 'center',
          gap: '12px'
        }}>
          <i className="fas fa-map-marker-alt" style={{ color: 'var(--text-tertiary)', fontSize: '14px' }}></i>
          <div>
            <div style={{ color: 'var(--text-primary)', fontSize: '13px', fontWeight: 600 }}>{item.name}</div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '11px' }}>{item.sub}</div>
          </div>
        </div>
      ))}
    </div>
  </div>
);

// Section content wrapper with consistent list spacing and font size
const SectionContent = ({ children }: { children: React.ReactNode }) => (
  <div style={{ fontSize: '12px', lineHeight: '1.6' }}>
    <style>{`
      #tech-content-area ul { padding-left: 20px; margin: 10px 0; }
      #tech-content-area ul li { margin-bottom: 12px; color: var(--text-secondary); }
      #tech-content-area p { margin-bottom: 15px; color: var(--text-secondary); }
      #tech-content-area code { font-size: 11px; }
      #tech-content-area pre { font-size: 11px; }
    `}</style>
    {children}
  </div>
);

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
      const containerRect = contentContainer.getBoundingClientRect();
      const elementRect = element.getBoundingClientRect();
      const scrollTop = elementRect.top - containerRect.top + contentContainer.scrollTop;
      
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
          <div style={{ padding: '12px', paddingBottom: '2rem' }}>
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
          id="tech-content-area"
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

          <section id="find-my-stop" style={{ marginBottom: '40px', scrollMarginTop: '80px' }}>
            <h2 style={{ color: 'var(--text-primary)', marginBottom: '20px', fontSize: '24px' }}>
              Find My Stop (The Explorer)
            </h2>
            <SectionContent>
              <p>
                The Explorer is the primary interface for users to discover bus routes. It allows for school discovery,
                route exploration, and finding the closest stops to a user's home address.
              </p>
            </SectionContent>

            <div id="school-explorer" style={{ marginBottom: '40px', scrollMarginTop: '80px' }}>
              <h3 style={{ color: 'var(--text-primary)', marginBottom: '15px', fontSize: '18px' }}>
                1. School Explorer (Discovery)
              </h3>
              <SectionContent>
                <p>
                  Users start by selecting a school. Schools are the primary organizational unit for bus routes.
                </p>
                <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '15px', borderRadius: '8px', marginBottom: '15px' }}>
                  <strong style={{ color: 'var(--text-primary)' }}>Key Features:</strong>
                  <ul>
                    <li><strong>Search & Filter</strong> - Search by school name or address, and filter by level (Elementary, Middle, High).</li>
                    <li><strong>Color Coding</strong> - Schools are color-coded by type for quick visual identification on the map.</li>
                    <li><strong>Route Stats</strong> - Shows the number of routes available for each school.</li>
                  </ul>
                </div>
                <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '15px', borderRadius: '8px', marginBottom: '15px' }}>
                  <strong style={{ color: 'var(--text-primary)' }}>Tech Detail:</strong>
                  <ul>
                    <li><strong>API</strong> - Powered by the <code>GET /api/schools</code> endpoint.</li>
                    <li><strong>Store</strong> - Managed via <code>useStore</code> which handles the filtered school list.</li>
                  </ul>
                </div>
              </SectionContent>
            </div>

            <div id="route-explorer" style={{ marginBottom: '40px', scrollMarginTop: '80px' }}>
              <h3 style={{ color: 'var(--text-primary)', marginBottom: '15px', fontSize: '18px' }}>
                2. Route Explorer (Detail)
              </h3>
              <SectionContent>
                <p>
                  Once a school is selected, users can explore specific morning and afternoon routes.
                </p>
                
                <div style={{ 
                  backgroundColor: 'var(--bg-secondary)', 
                  borderRadius: '12px', 
                  border: '1px solid var(--border-color)',
                  overflow: 'hidden',
                  marginBottom: '20px',
                  maxWidth: '400px'
                }}>
                  <RouteListBase 
                    routes={[
                      { ...exampleRoute, isSelected: true },
                      { ...exampleRoute, id: 'route-2', name: '104', color: '#10b981', isSelected: false }
                    ]} 
                    config={{ 
                      showRouteSelection: true,
                      directionFilter: 'Morning'
                    }} 
                  />
                </div>

                <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '15px', borderRadius: '8px', marginBottom: '15px' }}>
                  <strong style={{ color: 'var(--text-primary)' }}>Key Features:</strong>
                  <ul>
                    <li><strong>Selection</strong> - Toggle multiple routes to see overlapping coverage areas.</li>
                    <li><strong>Directional View</strong> - Switch between Morning and Afternoon schedules.</li>
                    <li><strong>Stop Lists</strong> - View sequential stops with arrival times.</li>
                  </ul>
                </div>
              </SectionContent>
            </div>

            <div id="address-lookup" style={{ marginBottom: '40px', scrollMarginTop: '80px' }}>
              <h3 style={{ color: 'var(--text-primary)', marginBottom: '15px', fontSize: '18px' }}>
                3. Address Search & Autocomplete
              </h3>
              <SectionContent>
                <p>
                  The "Find My Stop" feature uses address search to center the map and find the nearest stops.
                </p>

                <AddressInputUIPreview />

                <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '15px', borderRadius: '8px', marginBottom: '15px' }}>
                  <strong style={{ color: 'var(--text-primary)' }}>Key Features:</strong>
                  <ul>
                    <li><strong>Autocomplete</strong> - Real-time suggestions as the user types their home address.</li>
                    <li><strong>Proximity Matching</strong> - Once an address is selected, the app highlights the closest stop on the map.</li>
                  </ul>
                </div>
              </SectionContent>
            </div>

            <div id="assigned-schools" style={{ marginBottom: '40px', scrollMarginTop: '80px' }}>
              <h3 style={{ color: 'var(--text-primary)', marginBottom: '15px', fontSize: '18px' }}>
                4. Assigned Schools Lookup
              </h3>
              <SectionContent>
                <p>
                  Automatically identifies which PPS schools are assigned to a specific home address based on official attendance boundaries.
                </p>
                <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '15px', borderRadius: '8px', marginBottom: '15px' }}>
                  <strong style={{ color: 'var(--text-primary)' }}>Key Features:</strong>
                  <ul>
                    <li><strong>Automatic Sorting</strong> - Assigned schools are automatically moved to the top of the school list for easy access.</li>
                    <li><strong>Grade Level Detection</strong> - Identifies the assigned elementary, middle, and high school for any location in Portland.</li>
                    <li><strong>State Persistence</strong> - Assigned schools are refetched on page load if a home address is saved, ensuring the list is always personalized.</li>
                  </ul>
                </div>
                <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '15px', borderRadius: '8px', marginBottom: '15px' }}>
                  <strong style={{ color: 'var(--text-primary)' }}>Tech Detail:</strong>
                  <ul>
                    <li><strong>Service</strong> - Uses <code>SchoolBoundaryService</code> on the backend which queries local GeoJSON boundary data (no external API calls required).</li>
                    <li><strong>Endpoint</strong> - Powered by <code>GET /api/schools/assigned</code>.</li>
                    <li><strong>Standardized</strong> - Matches schools by name using fuzzy matching to account for naming variations between datasets.</li>
                  </ul>
                </div>
              </SectionContent>
            </div>

            <div id="neighborhood-explorer" style={{ marginBottom: '40px', scrollMarginTop: '80px' }}>
              <h3 style={{ color: 'var(--text-primary)', marginBottom: '15px', fontSize: '18px' }}>
                5. Neighborhood Directory
              </h3>
              <SectionContent>
                <p>
                  A cross-reference of routes organized by the neighborhoods they serve.
                </p>
                <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '15px', borderRadius: '8px', marginBottom: '15px' }}>
                  <strong style={{ color: 'var(--text-primary)' }}>Key Features:</strong>
                  <ul>
                    <li><strong>Discovery by Area</strong> - Find routes based on neighborhood name rather than school.</li>
                    <li><strong>Stop Densities</strong> - Shows how many stops are in a given area.</li>
                  </ul>
                </div>
              </SectionContent>
            </div>
          </section>

          <section id="map-interface" style={{ marginBottom: '40px', scrollMarginTop: '80px' }}>
            <h2 style={{ color: 'var(--text-primary)', marginBottom: '20px', fontSize: '24px' }}>
              Map Components & UI
            </h2>
            <SectionContent>
              <p>
                The interactive map is built with Leaflet and React-Leaflet. It serves as the primary canvas for
                visualizing the relationships between schools, stops, and the streets connecting them.
              </p>
            </SectionContent>

            <div id="school-pins" style={{ marginBottom: '40px', scrollMarginTop: '80px' }}>
              <h3 style={{ color: 'var(--text-primary)', marginBottom: '15px', fontSize: '18px' }}>
                1. School Pins & Icons
              </h3>
              <SectionContent>
                <p>
                  Schools are represented by large, high-contrast icons that help users orient themselves.
                </p>
                
                <div style={{ display: 'flex', gap: '15px', marginBottom: '20px', flexWrap: 'wrap' }}>
                  <MapPinPreview type="school" color="#3b82f6" state="Elementary" />
                  <MapPinPreview type="school" color="#10b981" state="Middle" />
                  <MapPinPreview type="school" color="#f59e0b" state="High School" />
                  <MapPinPreview type="school" color="#8b5cf6" state="Hybrid/Other" />
                </div>

                <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '15px', borderRadius: '8px', marginBottom: '15px' }}>
                  <strong style={{ color: 'var(--text-primary)' }}>Visual Detail:</strong>
                  <ul>
                    <li><strong>Standardized Symbols</strong> - Every school uses a consistent academic symbol for quick identification.</li>
                    <li><strong>Level Colors</strong> - Blue (Elementary), Green (Middle), Orange (High), Purple (Hybrid).</li>
                    <li><strong>Interactions</strong> - Clicking a school pin auto-selects that school and zooms the map.</li>
                  </ul>
                </div>
              </SectionContent>
            </div>

            <div id="stop-pins" style={{ marginBottom: '40px', scrollMarginTop: '80px' }}>
              <h3 style={{ color: 'var(--text-primary)', marginBottom: '15px', fontSize: '18px' }}>
                2. Stop Pins & Numbering
              </h3>
              <SectionContent>
                <p>
                  Bus stops are the granular points of contact for users. They are designed to be readable even when crowded.
                </p>

                <div style={{ display: 'flex', gap: '20px', marginBottom: '25px', flexWrap: 'wrap' }}>
                  <MapPinPreview type="stop" state="Default" color="#3b82f6" />
                  <MapPinPreview type="stop" state="Hover State" color="#3b82f6" isHover={true} />
                  <MapPinPreview type="stop" state="Selected" color="#3b82f6" isSelected={true} />
                </div>

                <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '15px', borderRadius: '8px', marginBottom: '15px' }}>
                  <strong style={{ color: 'var(--text-primary)' }}>Visual Detail:</strong>
                  <ul>
                    <li><strong>The "Lens" Effect</strong> - Default stops use a transparent center window that reveals the map behind, reducing visual clutter.</li>
                    <li><strong>Dynamic Sizing</strong> - When a stop is selected, it grows in size, gains a pulse animation, and centers itself.</li>
                    <li><strong>Sequential Numbering</strong> - Stops are numbered 1, 2, 3... along the route to indicate the path of the bus.</li>
                  </ul>
                </div>
              </SectionContent>
            </div>

            <div id="route-lines" style={{ marginBottom: '40px', scrollMarginTop: '80px' }}>
              <h3 style={{ color: 'var(--text-primary)', marginBottom: '15px', fontSize: '18px' }}>
                3. Route Polylines (Street Geometry)
              </h3>
              <SectionContent>
                <p>
                  Unlike simple point-to-point lines, our routes follow the actual street grid for realistic visualization.
                </p>

                <FullRoutePreview route={exampleRoute} />

                <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '15px', borderRadius: '88px', marginBottom: '15px' }}>
                  <strong style={{ color: 'var(--text-primary)' }}>Visual Detail:</strong>
                  <ul>
                    <li><strong>Curved Geometry</strong> - Polylines snap to roads using actual driving directions.</li>
                    <li><strong>Color Harmony</strong> - Lines match the color of the sidebar tabs and stop markers for that specific route.</li>
                  </ul>
                </div>
              </SectionContent>
            </div>

            <div id="info-dialogs" style={{ marginBottom: '40px', scrollMarginTop: '80px' }}>
              <h3 style={{ color: 'var(--text-primary)', marginBottom: '15px', fontSize: '18px' }}>
                4. Tooltips & Info Panels
              </h3>
              <SectionContent>
                <p>
                  Contextual information appears when users interact with the map elements.
                </p>
                
                <div style={{ display: 'flex', gap: '20px', flexDirection: 'column', marginBottom: '20px' }}>
                  <div style={{ border: '1px solid var(--border-color)', borderRadius: '12px', padding: '20px', backgroundColor: 'var(--bg-secondary)' }}>
                    <div style={{ marginBottom: '10px', fontSize: '11px', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>School Info Dialog</div>
                    <div style={{ position: 'relative', height: '180px', width: '100%', border: '1px dashed var(--border-color)', borderRadius: '8px', overflow: 'hidden' }}>
                      <div style={{ position: 'absolute', bottom: '10px', right: '10px', width: '300px', pointerEvents: 'none' }}>
                        <SchoolInfoTooltip school={exampleSchool} />
                      </div>
                    </div>
                  </div>

                  <div style={{ border: '1px solid var(--border-color)', borderRadius: '12px', padding: '20px', backgroundColor: 'var(--bg-secondary)' }}>
                    <div style={{ marginBottom: '10px', fontSize: '11px', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>Stop Info Dialog</div>
                    <div style={{ position: 'relative', height: '180px', width: '100%', border: '1px dashed var(--border-color)', borderRadius: '8px', overflow: 'hidden' }}>
                      <div style={{ position: 'absolute', bottom: '10px', right: '10px', width: '300px', pointerEvents: 'none' }}>
                        <StopInfoTooltip route={exampleRoute} stop={exampleStop} stopNumber={1} onClose={() => {}} />
                      </div>
                    </div>
                  </div>

                  <div style={{ border: '1px solid var(--border-color)', borderRadius: '12px', padding: '20px', backgroundColor: 'var(--bg-secondary)' }}>
                    <div style={{ marginBottom: '10px', fontSize: '11px', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>Specialized Modals (Compound System)</div>
                    <div style={{ padding: '0', backgroundColor: 'var(--bg-secondary)', borderRadius: '16px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                      <div style={{ padding: '20px 24px 0', color: 'var(--text-primary)', fontSize: '16px' }}>Modal Title Pattern</div>
                      <div style={{ padding: '16px 24px 20px', fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                        The Modal system uses a compound pattern (Modal.Title, Modal.Description) to enforce high-fidelity typography.
                      </div>
                      <div style={{ padding: '0 20px 20px' }}>
                        <div style={{ width: '100%', padding: '10px', backgroundColor: 'var(--bg-tertiary)', borderRadius: '46px', color: 'var(--text-primary)', textAlign: 'center', fontSize: '13px', border: '1px solid var(--border-color)' }}>Button Component</div>
                      </div>
                    </div>
                  </div>
                </div>

                <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '15px', borderRadius: '8px', marginBottom: '15px' }}>
                  <strong style={{ color: 'var(--text-primary)' }}>Visual Detail:</strong>
                  <ul>
                    <li><strong>Stop Overlays</strong> - Desktop users see a floating bottom-right panel; mobile users see a bottom sheet.</li>
                    <li><strong>School Tooltips</strong> - Hovering or clicking a school pin shows its name, address, and a "View Routes" CTA.</li>
                    <li><strong>Compound Modal System</strong> - Specialized <code>Modal.Title</code> and <code>Modal.Description</code> components ensure consistent typography across all alerts.</li>
                    <li><strong>Pill Buttons</strong> - The <code>Button</code> component implements the high-fidelity rounded design seen in Figma.</li>
                  </ul>
                </div>
              </SectionContent>
            </div>

            <div id="advanced-map-interactions" style={{ marginBottom: '40px', scrollMarginTop: '80px' }}>
              <h3 style={{ color: 'var(--text-primary)', marginBottom: '15px', fontSize: '18px' }}>
                5. Advanced Interactions (Undo & Pins)
              </h3>
              <SectionContent>
                <p>
                  Specialized interactions for improved UX and administrative data correction.
                </p>

                <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '15px', borderRadius: '8px', marginBottom: '15px' }}>
                  <strong style={{ color: 'var(--text-primary)' }}>Key Features:</strong>
                  <ul>
                    <li><strong>Undo History</strong> - When editing stop coordinates (admin mode), the app maintains a local undo history (5 steps) for immediate correction.</li>
                    <li><strong>Street Pins (Drop Pins)</strong> - Admins can drop pins at street intersections to verify geocoding accuracy and street connectivity.</li>
                    <li><strong>Kinetic FlyTo</strong> - Uses <code>flyTo</code> animations with opacity transitions for routes, creating a fluid "flying" effect when changing perspectives.</li>
                  </ul>
                </div>
              </SectionContent>
            </div>
          </section>

          <section id="data-pipeline" style={{ marginBottom: '40px', scrollMarginTop: '80px' }}>
            <h2 style={{ color: 'var(--text-primary)', marginBottom: '20px', fontSize: '24px' }}>
              Under the Hood: Data Flow
            </h2>
            <SectionContent>
              <p>
                The journey from raw PDF to interactive map involves several stages of synchronization,
                parsing, and geocoding.
              </p>
            </SectionContent>

            <div id="drive-sync" style={{ marginBottom: '40px', scrollMarginTop: '80px' }}>
              <h3 style={{ color: 'var(--text-primary)', marginBottom: '15px', fontSize: '18px' }}>
                1. Google Drive Sync
              </h3>
              <SectionContent>
                <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '15px', borderRadius: '8px', marginBottom: '15px' }}>
                  <strong style={{ color: 'var(--text-primary)' }}>Tech Detail:</strong>
                  <ul>
                    <li><strong>DriveService</strong> - Handles the recursive fetching of PDF files. It uses the official Google Drive API when available, but can fallback to HTML scraping for public folders.</li>
                    <li><strong>PDF Sync</strong> - A daily job that checks for new or updated files and downloads them to the local <code>data/schools/{'{schoolId}'}/pdfs/</code> directory.</li>
                  </ul>
                </div>
              </SectionContent>
            </div>

            <div id="pdf-processing" style={{ marginBottom: '40px', scrollMarginTop: '80px' }}>
              <h3 style={{ color: 'var(--text-primary)', marginBottom: '15px', fontSize: '18px' }}>
                2. PDF Processing & Extraction
              </h3>
              <SectionContent>
                <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '15px', borderRadius: '8px', marginBottom: '15px' }}>
                  <strong style={{ color: 'var(--text-primary)' }}>Tech Detail:</strong>
                  <ul>
                    <li><strong>PdfParser</strong> - Uses regular expressions to extract stop addresses, times, and route IDs from the semi-structured text of bus schedules. It uses stop order numbering (e.g., "(1)", "(2)") to distinguish student stops from transitional "deadhead" movements to other schools.</li>
                    <li><strong>RouteProcessor</strong> - The orchestrator that coordinates between parsing text, geocoding addresses, and saving the final JSON. It automatically filters out loading zones and non-student stops.</li>
                  </ul>
                </div>
              </SectionContent>
            </div>

            <div id="geocoding-logic" style={{ marginBottom: '40px', scrollMarginTop: '80px' }}>
              <h3 style={{ color: 'var(--text-primary)', marginBottom: '15px', fontSize: '18px' }}>
                3. Address Geocoding
              </h3>
              <SectionContent>
                <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '15px', borderRadius: '8px', marginBottom: '15px' }}>
                  <strong style={{ color: 'var(--text-primary)' }}>Tech Detail:</strong>
                  <ul>
                    <li><strong>GeocodingService</strong> - Interfaces with Google Maps Geocoding API. It handles intersection parsing (e.g., "A & B") specifically to ensure pins are placed exactly in the middle of crossings.</li>
                    <li><strong>Caching</strong> - To save costs and improve speed, all geocoding results are cached in <code>data/cache/</code>.</li>
                  </ul>
                </div>
              </SectionContent>
            </div>

            <div id="url-state" style={{ marginBottom: '40px', scrollMarginTop: '80px' }}>
              <h3 style={{ color: 'var(--text-primary)', marginBottom: '15px', fontSize: '18px' }}>
                4. URL Deep Linking & State
              </h3>
              <SectionContent>
                <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '15px', borderRadius: '8px', marginBottom: '15px' }}>
                  <strong style={{ color: 'var(--text-primary)' }}>Architecture & Synchronization:</strong>
                  <ul>
                    <li><strong>Single Source of Truth</strong> - The URL is the primary source of truth for all selection state (school, tab, direction, routes, stops, and map focus).</li>
                    <li><strong>useUrlState Hook</strong> - A custom hook that derives application state from the current URL path and provides actions that update the URL, ensuring bidirectional sync is actually a unidirectional flow from URL to UI.</li>
                    <li><strong>Map Intent System</strong> - Changes in the URL trigger "Map Intents" (e.g., <code>ZOOM_STOP</code>, <code>FIT_ROUTES</code>) which are dispatched to the store and then handled by the <code>MapView</code> to ensure the map always reflects the current URL state.</li>
                    <li><strong>Persistence</strong> - Selection state is naturally persisted in the browser history, allowing for seamless back/forward navigation and easy sharing of specific views.</li>
                  </ul>
                </div>
                <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '15px', borderRadius: '8px', marginBottom: '15px' }}>
                  <strong style={{ color: 'var(--text-primary)' }}>URL Schema:</strong>
                  <p style={{ marginTop: '8px', fontFamily: 'monospace', fontSize: '11px' }}>
                    /:schoolId/:tab/:direction/:routeNames/stops/:stopId/focus/:focus
                  </p>
                  <ul>
                    <li><strong>schoolId</strong> - The unique identifier for the selected school (e.g., <code>west-sylvan</code>).</li>
                    <li><strong>tab</strong> - The active sidebar tab (<code>schools</code>, <code>routes</code>, or <code>neighborhoods</code>).</li>
                    <li><strong>direction</strong> - The route direction filter (<code>morning</code>, <code>afternoon</code>, or <code>both</code>).</li>
                    <li><strong>routeNames</strong> - Comma-separated list of selected route numbers.</li>
                    <li><strong>stopId</strong> - The ID of the currently focused bus stop.</li>
                    <li><strong>focus</strong> - Specialized map focus targets (<code>school-info</code>, <code>home</code>, <code>my-stop</code>, or specific coordinates).</li>
                  </ul>
                </div>
              </SectionContent>
            </div>

            <div id="walking-distance-matrix" style={{ marginBottom: '40px', scrollMarginTop: '80px' }}>
              <h3 style={{ color: 'var(--text-primary)', marginBottom: '15px', fontSize: '18px' }}>
                5. Walking Distance Matrix
              </h3>
              <SectionContent>
                <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '15px', borderRadius: '8px', marginBottom: '15px' }}>
                  <strong style={{ color: 'var(--text-primary)' }}>Tech Detail:</strong>
                  <ul>
                    <li><strong>RoutesService</strong> - Uses the modern Google Routes API v2 (specifically <code>computeRouteMatrix</code>) to calculate walking distances from a home address to multiple stop candidates in a single request.</li>
                    <li><strong>Efficiency</strong> - Replacing multiple individual Directions API calls with a single matrix request reduces latency, minimizes API overhead, and ensures the user always gets the mathematically closest stop by street distance.</li>
                  </ul>
                </div>
              </SectionContent>
            </div>

            <div id="performance-optimization" style={{ marginBottom: '40px', scrollMarginTop: '80px' }}>
              <h3 style={{ color: 'var(--text-primary)', marginBottom: '15px', fontSize: '18px' }}>
                6. Performance & Loading State
              </h3>
              <SectionContent>
                <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '15px', borderRadius: '8px', marginBottom: '15px' }}>
                  <strong style={{ color: 'var(--text-primary)' }}>Tech Detail:</strong>
                  <ul>
                    <li><strong>Loading Counter</strong> - The store uses a <code>loadingCount</code> to handle multiple concurrent API requests (e.g., schools and routes), ensuring the global <code>isLoading</code> state remains true until all tasks complete.</li>
                    <li><strong>Clean Loading</strong> - To prevent selection artifacts, the application explicitly clears route state immediately upon school selection changes, ensuring that the UI never displays routes from a previously viewed school while the new ones are loading.</li>
                    <li><strong>Route Stats Optimization</strong> - The <code>/api/schools</code> endpoint uses directory metadata and filename parsing to quickly count routes without expensive per-file <code>stat</code> calls.</li>
                  </ul>
                </div>
              </SectionContent>
            </div>
          </section>

          <section id="design-ops" style={{ marginBottom: '40px', scrollMarginTop: '80px' }}>
            <h2 style={{ color: 'var(--text-primary)', marginBottom: '20px', fontSize: '24px' }}>
              Design System & Operations
            </h2>
            <SectionContent>
              <p>
                The visual and operational aspects of the application, ensuring consistency, accessibility, and discoverability.
              </p>
            </SectionContent>

            <div id="themes" style={{ marginBottom: '40px', scrollMarginTop: '80px' }}>
              <h3 style={{ color: 'var(--text-primary)', marginBottom: '15px', fontSize: '18px' }}>
                1. Themes (Dark/Light)
              </h3>
              <SectionContent>
                <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '15px', borderRadius: '8px', marginBottom: '15px' }}>
                  <strong style={{ color: 'var(--text-primary)' }}>Visual Detail:</strong>
                  <ul>
                    <li><strong>Color Palette</strong> - Uses a refined dark palette for the map and sidebar to make colorful route lines pop.</li>
                    <li><strong>Contrast</strong> - All text colors meet AA accessibility standards against their respective backgrounds.</li>
                  </ul>
                </div>
              </SectionContent>
            </div>

            <div id="icons-typography" style={{ marginBottom: '40px', scrollMarginTop: '80px' }}>
              <h3 style={{ color: 'var(--text-primary)', marginBottom: '15px', fontSize: '18px' }}>
                2. Icons & Typography
              </h3>
              <SectionContent>
                <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '15px', borderRadius: '8px', marginBottom: '15px' }}>
                  <strong style={{ color: 'var(--text-primary)' }}>Visual Detail:</strong>
                  <ul>
                    <li><strong>Hierarchy</strong> - Uses clear font weights to distinguish between primary information (Stop Names) and secondary metadata (Arrival Times).</li>
                    <li><strong>Legibility</strong> - Prioritizes high-contrast typefaces that remain readable in both light and dark modes.</li>
                  </ul>
                </div>
              </SectionContent>
            </div>

            <div id="analytics" style={{ marginBottom: '40px', scrollMarginTop: '80px' }}>
              <h3 style={{ color: 'var(--text-primary)', marginBottom: '15px', fontSize: '18px' }}>
                3. Analytics & Usage
              </h3>
              <SectionContent>
                <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '15px', borderRadius: '8px', marginBottom: '15px' }}>
                  <strong style={{ color: 'var(--text-primary)' }}>Tech Detail:</strong>
                  <ul>
                    <li><strong>Google Analytics 4</strong> - Tracks page views and selection events.</li>
                    <li><strong>ApiUsageService</strong> - A backend service that monitors API quotas (like Google Maps) to prevent service interruptions.</li>
                  </ul>
                </div>
              </SectionContent>
            </div>

            <div id="seo" style={{ marginBottom: '40px', scrollMarginTop: '80px' }}>
              <h3 style={{ color: 'var(--text-primary)', marginBottom: '15px', fontSize: '18px' }}>
                4. SEO & Discovery
              </h3>
              <SectionContent>
                <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '15px', borderRadius: '8px', marginBottom: '15px' }}>
                  <strong style={{ color: 'var(--text-primary)' }}>Tech Detail:</strong>
                  <ul>
                    <li><strong>React Helmet</strong> - Manages dynamic meta tags for every school and route page, including Open Graph and Twitter cards.</li>
                    <li><strong>JSON-LD Structured Data</strong> - Implements <code>WebSite</code> and <code>Organization</code> schema to define the site name (Portland Public Schools Bus Route Map) for Google search results.</li>
                    <li><strong>Sitemap Generator</strong> - A daily script that generates <code>sitemap.xml</code> based on the latest school and route data.</li>
                  </ul>
                </div>
              </SectionContent>
            </div>
          </section>

          <section id="engineering-ops" style={{ marginBottom: '40px', scrollMarginTop: '80px' }}>
            <h2 style={{ color: 'var(--text-primary)', marginBottom: '20px', fontSize: '24px' }}>
              Deployment & Maintenance
            </h2>
            <SectionContent>
              <p>
                Our engineering standards and infrastructure ensure the app remains reliable and easy to maintain.
              </p>
            </SectionContent>

            <div id="autocomplete-geocoding" style={{ marginBottom: '40px', scrollMarginTop: '80px' }}>
              <h3 style={{ color: 'var(--text-primary)', marginBottom: '15px', fontSize: '18px' }}>
                1. Autocomplete & Geocoding
              </h3>
              <SectionContent>
                <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '15px', borderRadius: '8px', marginBottom: '15px' }}>
                  <strong style={{ color: 'var(--text-primary)' }}>Architecture & Performance:</strong>
                  <ul>
                    <li><strong>Google Places V1</strong> - Uses the latest Google Places API for high-quality address suggestions with low latency.</li>
                    <li><strong>Parallel Place Details</strong> - Fetches coordinates for all suggestions in parallel to provide instant visual feedback on the map.</li>
                    <li><strong>Performance Optimization</strong> - Address snapping (moving house pins to the street) is deferred until a selection is made, keeping autocomplete extremely responsive.</li>
                    <li><strong>Walking Distance Logic</strong> - When multiple bus stops are geographically close, the system calculates actual walking paths using the <code>RoutesService</code> (Google Routes Matrix API v2). This identifies the truly "closest" stop by street distance in a single efficient API call, even in areas with complex street geometry.</li>
                    <li><strong>Decoupled Services</strong> - Uses a lazy-loading dependency pattern between <code>GeocodingService</code> and <code>StreetGeometryService</code> to ensure high reliability and zero-deadlock initialization.</li>
                    <li><strong>Nominatim Fallback</strong> - Automatically falls back to OpenStreetMap (Nominatim) if Google API quotas are exceeded or the service is unavailable.</li>
                  </ul>
                </div>
              </SectionContent>
            </div>

            <div id="backend-performance" style={{ marginBottom: '40px', scrollMarginTop: '80px' }}>
              <h3 style={{ color: 'var(--text-primary)', marginBottom: '15px', fontSize: '18px' }}>
                2. Backend Performance & Stability
              </h3>
              <SectionContent>
                <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '15px', borderRadius: '8px', marginBottom: '15px' }}>
                  <strong style={{ color: 'var(--text-primary)' }}>Service Reliability:</strong>
                  <ul>
                    <li><strong>Port Configuration</strong> - The backend uses port <code>3005</code> by default to avoid conflicts with system services or IDE plugins (like Cursor extension host) which often claim port <code>3001</code>.</li>
                    <li><strong>I/O Chunking</strong> - Heavy endpoints like <code>/api/schools</code> use chunked processing (20 schools at a time) instead of full parallelism to prevent event loop blocking and file descriptor exhaustion.</li>
                    <li><strong>Request Logging</strong> - Real-time request logging in the backend provides visibility into throughput and potential bottlenecks.</li>
                  </ul>
                </div>
              </SectionContent>
            </div>

            <div id="deployment" style={{ marginBottom: '40px', scrollMarginTop: '80px' }}>
              <h3 style={{ color: 'var(--text-primary)', marginBottom: '15px', fontSize: '18px' }}>
                3. Deployment Pipeline
              </h3>
              <SectionContent>
                <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '15px', borderRadius: '8px', marginBottom: '15px' }}>
                  <strong style={{ color: 'var(--text-primary)' }}>Process Detail:</strong>
                  <ul>
                    <li><strong>deploy.sh</strong> - Pulls the latest code, rebuilds the frontend, restarts the Node.js production server, and updates the sitemap.</li>
                    <li><strong>Environment</strong> - We use PM2 for process management and automatic restarts if the server crashes.</li>
                  </ul>
                </div>
              </SectionContent>
            </div>

            <div id="testing" style={{ marginBottom: '40px', scrollMarginTop: '80px' }}>
              <h3 style={{ color: 'var(--text-primary)', marginBottom: '15px', fontSize: '18px' }}>
                3. Testing Infrastructure
              </h3>
              <SectionContent>
                <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '15px', borderRadius: '8px', marginBottom: '15px' }}>
                  <strong style={{ color: 'var(--text-primary)' }}>Process Detail:</strong>
                  <ul>
                    <li><strong>Vitest</strong> - Handles our frontend unit and integration tests.</li>
                    <li><strong>Node Test Runner</strong> - Used for backend service and route verification.</li>
                    <li><strong>CI Verification</strong> - Every deployment runs a full build and type check to catch errors before they reach users.</li>
                  </ul>
                </div>
              </SectionContent>
            </div>

            <div id="file-structure" style={{ marginBottom: '40px', scrollMarginTop: '80px' }}>
              <h3 style={{ color: 'var(--text-primary)', marginBottom: '15px', fontSize: '18px' }}>
                4. Project Organization
              </h3>
              <SectionContent>
                <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '15px', borderRadius: '8px', marginBottom: '15px' }}>
                  <strong style={{ color: 'var(--text-primary)' }}>Process Detail:</strong>
                  <ul>
                    <li><strong>/frontend</strong> - All React components, styles, and store logic.</li>
                    <li><strong>/backend</strong> - Service classes, API routes, and data parsers.</li>
                    <li><strong>/data</strong> - The local JSON database and cached assets.</li>
                  </ul>
                </div>
              </SectionContent>
            </div>

            <div id="maintenance" style={{ marginBottom: '40px', scrollMarginTop: '80px' }}>
              <h3 style={{ color: 'var(--text-primary)', marginBottom: '15px', fontSize: '18px' }}>
                5. Maintenance & Jobs
              </h3>
              <SectionContent>
                <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '15px', borderRadius: '8px', marginBottom: '15px' }}>
                  <strong style={{ color: 'var(--text-primary)' }}>Process Detail:</strong>
                  <ul>
                    <li><strong>SchedulerService</strong> - Manages the daily sync with Google Drive and PDF reprocessing.</li>
                    <li><strong>Job Queue</strong> - A persistent queue system that handles long-running geocoding and parsing tasks in the background.</li>
                  </ul>
                </div>
              </SectionContent>
            </div>
          </section>

          <section id="data-examples" style={{ marginBottom: '40px', scrollMarginTop: '80px' }}>
            <h2 style={{ color: 'var(--text-primary)', marginBottom: '20px', fontSize: '24px' }}>
              Data Schemas & Examples
            </h2>
            <SectionContent>
              <p>
                Reference schemas for the core data structures used throughout the application.
              </p>
            </SectionContent>

            <div id="processed-route-example" style={{ marginBottom: '30px', scrollMarginTop: '80px' }}>
              <h3 style={{ color: 'var(--text-primary)', marginBottom: '10px', fontSize: '18px' }}>
                Processed Route Example
              </h3>
              <SectionContent>
                <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '15px', borderRadius: '8px', marginBottom: '15px' }}>
                  <strong style={{ color: 'var(--text-primary)' }}>Note:</strong>
                  <ul>
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
                  fontSize: '11px'
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
              </SectionContent>
            </div>

            <div id="school-entry-example" style={{ marginBottom: '30px', scrollMarginTop: '80px' }}>
              <h3 style={{ color: 'var(--text-primary)', marginBottom: '10px', fontSize: '18px' }}>
                School Entry Example
              </h3>
              <SectionContent>
                <pre style={{ 
                  backgroundColor: '#1e1e1e', 
                  padding: '15px', 
                  borderRadius: '4px', 
                  overflow: 'auto',
                  color: '#d4d4d4',
                  fontSize: '11px'
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
              </SectionContent>
            </div>

            <div id="neighborhood-data-example" style={{ marginBottom: '30px', scrollMarginTop: '80px' }}>
              <h3 style={{ color: 'var(--text-primary)', marginBottom: '10px', fontSize: '18px' }}>
                Neighborhood Data Example
              </h3>
              <SectionContent>
                <pre style={{ 
                  backgroundColor: '#1e1e1e', 
                  padding: '15px', 
                  borderRadius: '4px', 
                  overflow: 'auto',
                  color: '#d4d4d4',
                  fontSize: '11px'
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
              </SectionContent>
            </div>
          </section>

        </div>
      </div>
    </div>
  );
}
