import { useState, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { Header } from '../components/Header';
import { Footer } from '../components/Footer';
import { ProgressBar } from '../components/ProgressBar';
import { DarkModeToggle } from '../components/DarkModeToggle';
import { RouteIcon } from '../components/RouteIcon';
import { MapPinIcon } from '../components/MapPinIcon';
import { ChevronIcon } from '../components/ChevronIcon';
import { XIcon } from '../components/XIcon';
import { BackendStatus } from '../components/BackendStatus';
import { ExpandableExample } from '../components/ExpandableExample';
import { Modal } from '../components/Modal';
import { Button } from '../components/Button';
import { SchoolBusFront } from '../components/SchoolBusFront';
import { RouteListBase } from '../components/RouteListBase';
import { SchoolList } from '../components/SchoolList';
import { AddressInput } from '../components/AddressInput';
import { AddressLookup } from '../components/AddressLookup';
import { TabBar } from '../components/TabBar';
import { SchoolSelector } from '../components/SchoolSelector';
import { DriveLinkInput } from '../components/DriveLinkInput';
import { SchoolTypeFilter, SchoolTypeFilters } from '../components/SchoolTypeFilter';
import { MapInfoPanel } from '../components/MapInfoPanel';
import { SchoolInfoTooltip } from '../components/SchoolInfoTooltip';
import { StopInfoTooltip } from '../components/StopInfoTooltip';
import { HomeInfoTooltip } from '../components/HomeInfoTooltip';
import { exampleSchool, exampleRoute, exampleStop, exampleHomeAddress, exampleSchools, exampleRoutes, exampleAssignedSchools } from '../utils/dummyData';

const FA_ICONS = [
  'fa-bars', 'fa-bus', 'fa-check', 'fa-check-circle', 'fa-chevron-down', 'fa-circle',
  'fa-circle-notch fa-spin', 'fa-city', 'fa-clock', 'fa-cogs', 'fa-cubes', 'fa-database',
  'fa-directions', 'fa-download', 'fa-edit', 'fa-envelope', 'fa-exclamation-circle',
  'fa-exclamation-triangle', 'fa-external-link-alt', 'fa-file-pdf', 'fa-folder-open',
  'fa-globe', 'fa-graduation-cap', 'fa-home', 'fa-hourglass-half', 'fa-house',
  'fa-icons', 'fa-info-circle', 'fa-link', 'fa-list', 'fa-lock', 'fa-map',
  'fa-map-marker-alt', 'fa-moon', 'fa-palette', 'fa-phone', 'fa-plus',
  'fa-question-circle', 'fa-school', 'fa-search', 'fa-search-location', 'fa-server',
  'fa-sign-in-alt', 'fa-sign-out-alt', 'fa-spinner fa-spin', 'fa-sun', 'fa-sync',
  'fa-sync-alt fa-spin', 'fa-table', 'fa-tasks', 'fa-times', 'fa-times-circle',
  'fa-trash-alt', 'fa-undo'
];

const StaticModal = ({ children, maxWidth = '345px' }: { children: React.ReactNode, maxWidth?: string }) => (
  <div style={{
    backgroundColor: 'var(--modal-bg)',
    borderRadius: '24px',
    width: '100%',
    maxWidth: maxWidth,
    boxShadow: '0 20px 40px var(--shadow-large)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    position: 'relative',
    border: '1px solid var(--border-color)',
  }}>
    {children}
  </div>
);

export function DesignSystemPage() {
  const [activeView, setActiveView] = useState<'components' | 'icons'>('components');
  const [activeSection, setActiveSection] = useState<string>('');

  useEffect(() => {
    const rootElement = document.getElementById('root');
    if (rootElement) {
      rootElement.style.overflow = 'auto';
      rootElement.style.height = 'auto';
      rootElement.style.minHeight = '100vh';
    }
    document.body.style.overflow = 'auto';
    document.documentElement.style.overflow = 'auto';
    
    return () => {
      if (rootElement) {
        rootElement.style.overflow = 'hidden';
        rootElement.style.height = 'var(--app-height)';
      }
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
    };
  }, []);

  const [activeTab, setActiveTab] = useState<'schools' | 'routes' | 'neighborhoods'>('schools');
  
  const [schoolTypeFilters, setSchoolTypeFilters] = useState<SchoolTypeFilters>({
    elementary: true,
    middle: true,
    high: true,
    hybrid: true,
    noRoutes: true,
  });

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
      setActiveSection(id);
    }
  };

  const sections = [
    { id: 'buttons', title: 'Buttons' },
    { id: 'controls', title: 'Controls' },
    { id: 'progress', title: 'Progress & Loading' },
    { id: 'forms', title: 'Form Elements' },
    { id: 'interactive', title: 'Interactive Components' },
    { id: 'lists', title: 'Lists & Data' },
    { id: 'modals', title: 'Modals & Tooltips' },
    { id: 'graphics', title: 'Graphics' },
    { id: 'layout', title: 'Layout' },
    { id: 'complex', title: 'Complex Components' },
  ];

  const Sidebar = () => (
    <aside style={{
      width: '280px',
      height: 'calc(100vh - 60px)',
      position: 'fixed',
      left: 0,
      top: '60px',
      padding: '2rem 1.5rem',
      borderRight: '1px solid var(--border-color)',
      backgroundColor: 'var(--bg-secondary)',
      display: 'flex',
      flexDirection: 'column',
      gap: '2rem',
      overflowY: 'auto',
      zIndex: 100,
    }}>
      <div>
        <h3 style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '1rem' }}>View</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <button
            onClick={() => setActiveView('components')}
            style={{
              padding: '0.75rem 1rem',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: activeView === 'components' ? 'var(--bg-primary)' : 'transparent',
              color: activeView === 'components' ? 'var(--text-primary)' : 'var(--text-secondary)',
              textAlign: 'left',
              cursor: 'pointer',
              fontWeight: activeView === 'components' ? '600' : '400',
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              transition: 'all 0.2s ease',
              boxShadow: activeView === 'components' ? '0 2px 4px rgba(0,0,0,0.05)' : 'none',
            }}
          >
            <i className="fas fa-cubes"></i> Components
          </button>
          <button
            onClick={() => setActiveView('icons')}
            style={{
              padding: '0.75rem 1rem',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: activeView === 'icons' ? 'var(--bg-primary)' : 'transparent',
              color: activeView === 'icons' ? 'var(--text-primary)' : 'var(--text-secondary)',
              textAlign: 'left',
              cursor: 'pointer',
              fontWeight: activeView === 'icons' ? '600' : '400',
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              transition: 'all 0.2s ease',
              boxShadow: activeView === 'icons' ? '0 2px 4px rgba(0,0,0,0.05)' : 'none',
            }}
          >
            <i className="fas fa-icons"></i> Icons
          </button>
        </div>
      </div>

      {activeView === 'components' && (
        <div>
          <h3 style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '1rem' }}>Sections</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            {sections.map(section => (
              <button
                key={section.id}
                onClick={() => scrollToSection(section.id)}
                style={{
                  padding: '0.5rem 1rem',
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: 'transparent',
                  color: activeSection === section.id ? 'var(--text-primary)' : 'var(--text-secondary)',
                  textAlign: 'left',
                  cursor: 'pointer',
                  fontSize: '0.9rem',
                  fontWeight: activeSection === section.id ? '600' : '400',
                  transition: 'all 0.2s ease',
                }}
              >
                {section.title}
              </button>
            ))}
          </div>
        </div>
      )}
    </aside>
  );

  const ComponentsContent = () => (
    <>
      {/* Buttons Section */}
      <section id="buttons" style={{ marginBottom: '6rem', scrollMarginTop: '100px' }}>
        <h2 style={{ fontSize: '2rem', fontWeight: '700', marginBottom: '2rem', color: 'var(--text-primary)', borderBottom: '2px solid var(--border-color)', paddingBottom: '0.5rem' }}>
          Buttons
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '2rem' }}>
          <div>
            <h3 style={{ fontSize: '1rem', fontWeight: '500', marginBottom: '1rem' }}>Primary Button (Large)</h3>
            <div style={{ padding: '2rem', backgroundColor: 'var(--bg-secondary)', borderRadius: '12px' }}>
              <Button variant="primary" size="large" fullWidth>Okay</Button>
            </div>
          </div>
          <div>
            <h3 style={{ fontSize: '1rem', fontWeight: '500', marginBottom: '1rem' }}>Secondary Button</h3>
            <div style={{ padding: '2rem', backgroundColor: 'var(--bg-secondary)', borderRadius: '12px', display: 'flex', gap: '10px' }}>
              <Button variant="secondary">Cancel</Button>
              <Button variant="secondary" size="small">Small</Button>
            </div>
          </div>
          <div>
            <h3 style={{ fontSize: '1rem', fontWeight: '500', marginBottom: '1rem' }}>Outline & Ghost</h3>
            <div style={{ padding: '2rem', backgroundColor: 'var(--bg-secondary)', borderRadius: '12px', display: 'flex', gap: '10px' }}>
              <Button variant="outline">Outline</Button>
              <Button variant="ghost">Ghost</Button>
            </div>
          </div>
        </div>
      </section>

      {/* Controls Section */}
      <section id="controls" style={{ marginBottom: '6rem', scrollMarginTop: '100px' }}>
        <h2 style={{ fontSize: '2rem', fontWeight: '700', marginBottom: '2rem', color: 'var(--text-primary)', borderBottom: '2px solid var(--border-color)', paddingBottom: '0.5rem' }}>
          Controls
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '2rem' }}>
          <div>
            <h3 style={{ fontSize: '1rem', fontWeight: '500', marginBottom: '1rem' }}>DarkModeToggle</h3>
            <div style={{ padding: '2rem', backgroundColor: 'var(--bg-secondary)', borderRadius: '12px' }}>
              <DarkModeToggle />
            </div>
          </div>
          <div>
            <h3 style={{ fontSize: '1rem', fontWeight: '500', marginBottom: '1rem' }}>BackendStatus</h3>
            <div style={{ padding: '2rem', backgroundColor: 'var(--bg-secondary)', borderRadius: '12px' }}>
              <BackendStatus />
            </div>
          </div>
        </div>
        <div style={{ marginTop: '2rem' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: '500', marginBottom: '1rem' }}>TabBar</h3>
          <div style={{ padding: '2rem', backgroundColor: 'var(--bg-secondary)', borderRadius: '12px' }}>
            <TabBar activeTab={activeTab} onTabChange={setActiveTab} />
          </div>
        </div>
        <div style={{ marginTop: '2rem' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: '500', marginBottom: '1rem' }}>SchoolTypeFilter</h3>
          <div style={{ padding: '2rem', backgroundColor: 'var(--bg-secondary)', borderRadius: '12px' }}>
            <SchoolTypeFilter filters={schoolTypeFilters} onChange={setSchoolTypeFilters} />
          </div>
        </div>
      </section>

      {/* Progress & Loading Section */}
      <section id="progress" style={{ marginBottom: '6rem', scrollMarginTop: '100px' }}>
        <h2 style={{ fontSize: '2rem', fontWeight: '700', marginBottom: '2rem', color: 'var(--text-primary)', borderBottom: '2px solid var(--border-color)', paddingBottom: '0.5rem' }}>
          Progress & Loading
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '2rem' }}>
          <div>
            <h3 style={{ fontSize: '1rem', fontWeight: '500', marginBottom: '1rem' }}>ProgressBar</h3>
            <div style={{ padding: '2rem', backgroundColor: 'var(--bg-secondary)', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <ProgressBar progress={45} label="Determinate Progress" showPercentage />
              <ProgressBar label="Indeterminate Progress" />
            </div>
          </div>
        </div>
      </section>

      {/* Form Elements Section */}
      <section id="forms" style={{ marginBottom: '6rem', scrollMarginTop: '100px' }}>
        <h2 style={{ fontSize: '2rem', fontWeight: '700', marginBottom: '2rem', color: 'var(--text-primary)', borderBottom: '2px solid var(--border-color)', paddingBottom: '0.5rem' }}>
          Form Elements
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))', gap: '2rem' }}>
          <div>
            <h3 style={{ fontSize: '1rem', fontWeight: '500', marginBottom: '1rem' }}>AddressInput</h3>
            <div style={{ padding: '2rem', backgroundColor: 'var(--bg-secondary)', borderRadius: '12px' }}>
              <AddressInput />
            </div>
          </div>
          <div>
            <h3 style={{ fontSize: '1rem', fontWeight: '500', marginBottom: '1rem' }}>AddressLookup</h3>
            <div style={{ padding: '2rem', backgroundColor: 'var(--bg-secondary)', borderRadius: '12px' }}>
              <AddressLookup onAddressSelect={() => {}} />
            </div>
          </div>
          <div>
            <h3 style={{ fontSize: '1rem', fontWeight: '500', marginBottom: '1rem' }}>SchoolSelector</h3>
            <div style={{ padding: '2rem', backgroundColor: 'var(--bg-secondary)', borderRadius: '12px' }}>
              <SchoolSelector />
            </div>
          </div>
          <div>
            <h3 style={{ fontSize: '1rem', fontWeight: '500', marginBottom: '1rem' }}>DriveLinkInput</h3>
            <div style={{ padding: '2rem', backgroundColor: 'var(--bg-secondary)', borderRadius: '12px' }}>
              <DriveLinkInput />
            </div>
          </div>
        </div>
      </section>

      {/* Interactive Components Section */}
      <section id="interactive" style={{ marginBottom: '6rem', scrollMarginTop: '100px' }}>
        <h2 style={{ fontSize: '2rem', fontWeight: '700', marginBottom: '2rem', color: 'var(--text-primary)', borderBottom: '2px solid var(--border-color)', paddingBottom: '0.5rem' }}>
          Interactive Components
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))', gap: '2rem' }}>
          <div>
            <h3 style={{ fontSize: '1rem', fontWeight: '500', marginBottom: '1rem' }}>ExpandableExample</h3>
            <div style={{ padding: '2rem', backgroundColor: 'var(--bg-secondary)', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <ExpandableExample title="Expandable Content" defaultExpanded={false}>
                <p style={{ color: 'var(--text-primary)', margin: 0 }}>Content inside expandable component.</p>
              </ExpandableExample>
            </div>
          </div>
        </div>
      </section>

      {/* Lists Section */}
      <section id="lists" style={{ marginBottom: '6rem', scrollMarginTop: '100px' }}>
        <h2 style={{ fontSize: '2rem', fontWeight: '700', marginBottom: '2rem', color: 'var(--text-primary)', borderBottom: '2px solid var(--border-color)', paddingBottom: '0.5rem' }}>
          Lists & Data Display
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(450px, 1fr))', gap: '3rem' }}>
          <div>
            <h3 style={{ fontSize: '1rem', fontWeight: '500', marginBottom: '1rem' }}>SchoolList (Default & Assigned)</h3>
            <div style={{ 
              height: '500px', 
              backgroundColor: 'var(--bg-secondary)', 
              borderRadius: '12px', 
              overflow: 'hidden',
              border: '1px solid var(--border-color)'
            }}>
              <SchoolList 
                schools={exampleSchools} 
                selectedSchoolId={null} 
                onSelectSchool={() => {}} 
                assignedSchools={exampleAssignedSchools}
              />
            </div>
          </div>
          <div>
            <h3 style={{ fontSize: '1rem', fontWeight: '500', marginBottom: '1rem' }}>RouteListBase (Morning/Afternoon Groups)</h3>
            <div style={{ 
              height: '500px', 
              backgroundColor: 'var(--bg-secondary)', 
              borderRadius: '12px', 
              overflow: 'auto',
              border: '1px solid var(--border-color)'
            }}>
              <RouteListBase 
                routes={exampleRoutes} 
                config={{
                  showRouteSelection: true,
                  directionFilter: 'Both',
                  isRouteSelected: (r) => r.id === 'route-example-1'
                }}
              />
            </div>
          </div>
        </div>
      </section>

      {/* Modals & Tooltips Section */}
      <section id="modals" style={{ marginBottom: '6rem', scrollMarginTop: '100px' }}>
        <h2 style={{ fontSize: '2rem', fontWeight: '700', marginBottom: '2rem', color: 'var(--text-primary)', borderBottom: '2px solid var(--border-color)', paddingBottom: '0.5rem' }}>
          Modals & Tooltips
        </h2>
        
        <h3 style={{ fontSize: '1.2rem', fontWeight: '600', marginBottom: '1.5rem', color: 'var(--text-primary)' }}>Standard Modals</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '2rem', marginBottom: '4rem' }}>
          <div>
            <h3 style={{ fontSize: '1rem', fontWeight: '500', marginBottom: '1rem' }}>Compound Modal</h3>
            <div style={{ padding: '2rem', backgroundColor: 'var(--bg-primary)', borderRadius: '12px', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'center' }}>
              <StaticModal>
                <Modal.Header><RouteIcon size={24} color="var(--text-primary)" /></Modal.Header>
                <Modal.Content>
                  <Modal.Title>Compound Modal System</Modal.Title>
                  <Modal.Description>Consistent typography and spacing across all dialogs.</Modal.Description>
                </Modal.Content>
                <Modal.Footer><Button fullWidth size="large">Understood</Button></Modal.Footer>
              </StaticModal>
            </div>
          </div>
          <div>
            <h3 style={{ fontSize: '1rem', fontWeight: '500', marginBottom: '1rem' }}>School Closest Modal</h3>
            <div style={{ padding: '2rem', backgroundColor: 'var(--bg-primary)', borderRadius: '12px', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'center' }}>
              <StaticModal>
                <Modal.Header>
                  <div style={{ display: 'flex', alignItems: 'flex-start' }}>
                    <svg width="25" height="26" viewBox="0 0 25 26" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M10.2705 0C11.9884 3.76818e-08 13.4472 1.10802 13.9717 2.64844H18.8242C21.8936 2.64853 24.3818 5.1367 24.3818 8.20605C24.3815 11.2752 21.8934 13.7636 18.8242 13.7637H5.98926C4.12152 13.7637 2.60742 15.2778 2.60742 17.1455C2.60769 19.013 4.12169 20.5273 5.98926 20.5273H16.3799C16.8585 18.7486 18.4812 17.4395 20.4111 17.4395C22.7174 17.4395 24.5869 19.309 24.5869 21.6152C24.5867 23.9213 22.7172 25.791 20.4111 25.791C18.4815 25.791 16.8588 24.4814 16.3799 22.7031H5.98926C2.92003 22.7031 0.431906 20.2147 0.431641 17.1455C0.431641 14.0761 2.91986 11.5879 5.98926 11.5879H18.8242C20.6917 11.5878 22.2058 10.0735 22.2061 8.20605C22.2061 6.33836 20.6919 4.82431 18.8242 4.82422H14.0713C13.6589 6.54105 12.1138 7.81738 10.2705 7.81738H3.9082C1.74966 7.81719 0.000126318 6.06677 0 3.9082C0.000195126 1.7497 1.7497 0.000192692 3.9082 0H10.2705ZM20.4111 19.6152C19.3066 19.6153 18.4111 20.5107 18.4111 21.6152C18.4114 22.7196 19.3067 23.6152 20.4111 23.6152C21.5156 23.6152 22.4109 22.7196 22.4111 21.6152C22.4111 20.5107 21.5157 19.6152 20.4111 19.6152ZM3.73145 2.18457C2.91577 2.26738 2.26738 2.91577 2.18457 3.73145L2.17578 3.9082C2.1759 4.80545 2.85757 5.54412 3.73145 5.63281L3.9082 5.6416H10.2705L10.4482 5.63281C11.322 5.544 12.0038 4.80535 12.0039 3.9082C12.0037 3.01112 11.3219 2.27339 10.4482 2.18457L10.2705 2.17578H3.9082L3.73145 2.18457Z" fill="var(--text-primary)"/>
                    </svg>
                  </div>
                </Modal.Header>
                <Modal.Content>
                  <Modal.Title>Glencoe is closer than any stop that is available</Modal.Title>
                  <Modal.Description>Walking might be best, or make sure that this is the correct school for your address</Modal.Description>
                </Modal.Content>
                <Modal.Footer><Button fullWidth size="large">Okay</Button></Modal.Footer>
              </StaticModal>
            </div>
          </div>
        </div>

        <h3 style={{ fontSize: '1.2rem', fontWeight: '600', marginBottom: '1.5rem', color: 'var(--text-primary)' }}>Map Tooltips</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '2rem' }}>
          <div>
            <h3 style={{ fontSize: '1rem', fontWeight: '500', marginBottom: '1rem' }}>SchoolInfoTooltip</h3>
            <div style={{ padding: '2rem', backgroundColor: 'var(--bg-secondary)', borderRadius: '12px', display: 'flex', justifyContent: 'center' }}>
              <SchoolInfoTooltip school={exampleSchool} showRoutesButton={true} />
            </div>
          </div>
          <div>
            <h3 style={{ fontSize: '1rem', fontWeight: '500', marginBottom: '1rem' }}>StopInfoTooltip</h3>
            <div style={{ padding: '2rem', backgroundColor: 'var(--bg-secondary)', borderRadius: '12px', display: 'flex', justifyContent: 'center' }}>
              <StopInfoTooltip route={exampleRoute} stop={exampleStop} stopNumber={1} onClose={() => {}} />
            </div>
          </div>
          <div>
            <h3 style={{ fontSize: '1rem', fontWeight: '500', marginBottom: '1rem' }}>HomeInfoTooltip</h3>
            <div style={{ padding: '2rem', backgroundColor: 'var(--bg-secondary)', borderRadius: '12px', display: 'flex', justifyContent: 'center' }}>
              <HomeInfoTooltip address={exampleHomeAddress} onClear={() => {}} />
            </div>
          </div>
        </div>
      </section>

      {/* Graphics Section */}
      <section id="graphics" style={{ marginBottom: '6rem', scrollMarginTop: '100px' }}>
        <h2 style={{ fontSize: '2rem', fontWeight: '700', marginBottom: '2rem', color: 'var(--text-primary)', borderBottom: '2px solid var(--border-color)', paddingBottom: '0.5rem' }}>
          Graphics
        </h2>
        <div style={{ padding: '2rem', backgroundColor: 'var(--bg-secondary)', borderRadius: '12px', display: 'flex', justifyContent: 'center' }}>
          <SchoolBusFront width={300} height={220} />
        </div>
      </section>

      {/* Layout Section */}
      <section id="layout" style={{ marginBottom: '6rem', scrollMarginTop: '100px' }}>
        <h2 style={{ fontSize: '2rem', fontWeight: '700', marginBottom: '2rem', color: 'var(--text-primary)', borderBottom: '2px solid var(--border-color)', paddingBottom: '0.5rem' }}>
          Layout Components
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem' }}>Header and Footer are consistent across all views.</p>
      </section>

      {/* Complex Components Section */}
      <section id="complex" style={{ marginBottom: '6rem', scrollMarginTop: '100px' }}>
        <h2 style={{ fontSize: '2rem', fontWeight: '700', marginBottom: '2rem', color: 'var(--text-primary)', borderBottom: '2px solid var(--border-color)', paddingBottom: '0.5rem' }}>
          Complex Components
        </h2>
        <div style={{ padding: '2rem', backgroundColor: 'var(--bg-secondary)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
          <ul style={{ color: 'var(--text-secondary)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', paddingLeft: '1.5rem' }}>
            <li>MapView</li><li>SchoolList</li><li>RouteListBase</li><li>SchoolInfoTooltip</li>
            <li>StopInfoTooltip</li><li>HomeInfoTooltip</li><li>Sidebar</li><li>JobList</li>
            <li>DataRouteList</li><li>DataPageHeader</li><li>AdminPasswordProtection</li>
            <li>SchoolClosestModal</li><li>SEO</li><li>WhoSection</li><li>DarkModeTileLayer</li>
          </ul>
        </div>
      </section>
    </>
  );

  const IconsContent = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4rem' }}>
      <section>
        <h2 style={{ fontSize: '2rem', fontWeight: '700', marginBottom: '2rem', color: 'var(--text-primary)', borderBottom: '2px solid var(--border-color)', paddingBottom: '0.5rem' }}>
          Custom SVG Icons
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '2rem' }}>
          <div style={{ padding: '2rem', backgroundColor: 'var(--bg-secondary)', borderRadius: '12px', textAlign: 'center' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: '500', marginBottom: '1.5rem' }}>RouteIcon</h3>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', alignItems: 'center' }}>
              <RouteIcon size={32} />
              <RouteIcon size={48} color="#3b82f6" />
            </div>
          </div>
          <div style={{ padding: '2rem', backgroundColor: 'var(--bg-secondary)', borderRadius: '12px', textAlign: 'center' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: '500', marginBottom: '1.5rem' }}>MapPinIcon</h3>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '1.5rem', alignItems: 'center' }}>
              <MapPinIcon width={24} height={32} />
              <MapPinIcon width={40} height={52} />
            </div>
          </div>
          <div style={{ padding: '2rem', backgroundColor: 'var(--bg-secondary)', borderRadius: '12px', textAlign: 'center' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: '500', marginBottom: '1.5rem' }}>ChevronIcon</h3>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem' }}>
              <ChevronIcon direction="down" size={24} />
              <ChevronIcon direction="up" size={24} />
              <ChevronIcon direction="left" size={24} />
              <ChevronIcon direction="right" size={24} />
            </div>
          </div>
          <div style={{ padding: '2rem', backgroundColor: 'var(--bg-secondary)', borderRadius: '12px', textAlign: 'center' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: '500', marginBottom: '1.5rem' }}>XIcon</h3>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', alignItems: 'center' }}>
              <XIcon size={24} />
              <XIcon size={40} color="#ef4444" />
            </div>
          </div>
        </div>
      </section>

      <section>
        <h2 style={{ fontSize: '2rem', fontWeight: '700', marginBottom: '2rem', color: 'var(--text-primary)', borderBottom: '2px solid var(--border-color)', paddingBottom: '0.5rem' }}>
          Font Awesome Icons
        </h2>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
          gap: '1.5rem',
          backgroundColor: 'var(--bg-secondary)',
          padding: '2rem',
          borderRadius: '16px',
        }}>
          {FA_ICONS.map(icon => (
            <div key={icon} style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '1rem',
              padding: '1.5rem 1rem',
              backgroundColor: 'var(--bg-primary)',
              borderRadius: '12px',
              transition: 'transform 0.2s ease',
              cursor: 'default',
            }} onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-4px)'} onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}>
              <i className={`fas ${icon}`} style={{ fontSize: '1.5rem', color: 'var(--text-primary)' }}></i>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', textAlign: 'center', fontFamily: 'monospace' }}>
                {icon.replace('fa-', '')}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      backgroundColor: 'var(--bg-primary)',
      color: 'var(--text-primary)',
    }}>
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 1001,
      }}>
        <Header />
      </div>
      
      <div style={{ display: 'flex', flex: 1, marginTop: '60px' }}>
        <Sidebar />
        
        <div style={{ 
          flex: 1, 
          display: 'flex', 
          flexDirection: 'column',
          marginLeft: '280px',
          minHeight: 'calc(100vh - 60px)',
        }}>
          <main style={{
            flex: 1,
            padding: '4rem 5rem',
            maxWidth: '1200px',
          }}>
          <header style={{ marginBottom: '4rem' }}>
            <h1 style={{ fontSize: '2.5rem', fontWeight: '800', marginBottom: '0.75rem', letterSpacing: '-0.02em' }}>
              Design System
            </h1>
            <p style={{ fontSize: '1.1rem', color: 'var(--text-secondary)', maxWidth: '600px', lineHeight: '1.6' }}>
              The visual language and component library powering the PPS Bus Maps platform.
            </p>
          </header>

            {activeView === 'components' ? <ComponentsContent /> : <IconsContent />}
          </main>

          <Footer />
        </div>
      </div>
    </div>
  );
}
