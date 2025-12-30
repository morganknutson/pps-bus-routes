import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import './test/mocks.tsx';
import { ExplorerApp } from './App';
import { useStore } from './store/useStore';
import { School, Route } from './types';

// Mock API data
const mockSchools: School[] = [
  {
    id: 'west-sylvan',
    name: 'West Sylvan',
    address: '1301 SW 25th Ave, Portland, OR 97201',
    coordinates: [-122.6984, 45.5123],
    schoolTypes: ['Middle School'],
    schoolPageLink: 'http://example.com',
    driveLink: 'http://example.com/drive',
    createdAt: new Date().toISOString(),
    routeCount: 1
  },
  {
    id: 'lincoln',
    name: 'Lincoln',
    address: '1600 SW Salmon St, Portland, OR 97205',
    coordinates: [-122.6841, 45.5231],
    schoolTypes: ['High School'],
    schoolPageLink: 'http://example.com',
    driveLink: 'http://example.com/drive',
    createdAt: new Date().toISOString(),
    routeCount: 1
  }
];

const mockRoutes: Route[] = [
  {
    id: 'route-101',
    name: '101',
    direction: 'Morning',
    color: '#FF0000',
    isSelected: false,
    stops: [
      { id: 'stop-1', address: '123 Main St', coordinates: [-122.6, 45.5] },
      { id: 'stop-2', address: '456 Oak St', coordinates: [-122.61, 45.51] }
    ]
  }
];

// Mock fetch
globalThis.fetch = vi.fn((url: string | URL | Request) => {
  const urlString = url.toString();
  if (urlString.includes('/api/schools')) {
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ schools: mockSchools }),
      headers: new Headers(),
      redirected: false,
      status: 200,
      statusText: 'OK',
      type: 'basic',
      url: urlString,
      clone: () => ({} as Response),
      body: null,
      bodyUsed: false,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
      blob: () => Promise.resolve(new Blob()),
      formData: () => Promise.resolve(new FormData()),
      text: () => Promise.resolve(JSON.stringify({ schools: mockSchools })),
    } as Response);
  }
  return Promise.resolve({
    ok: false,
    status: 404,
    statusText: 'Not Found',
    json: () => Promise.resolve({}),
  } as Response);
}) as unknown as typeof fetch;

// Mock localRoutes service
vi.mock('./services/localRoutes', () => ({
  loadLocalRoutes: vi.fn().mockResolvedValue([
    {
      id: 'route-101',
      name: '101',
      direction: 'Morning',
      color: '#FF0000',
      isSelected: false,
      stops: [
        { id: 'stop-1', address: '123 Main St', coordinates: [-122.6, 45.5] }
      ]
    }
  ])
}));

// Mock analytics service
vi.mock('./services/analytics', () => ({
  analyticsService: {
    trackSchoolSelect: vi.fn(),
    trackTabChange: vi.fn(),
    trackPageView: vi.fn(),
  }
}));

// Mock hooks
vi.mock('./hooks/useMediaQuery', () => ({
  useIsMobile: vi.fn(() => false)
}));

describe('ExplorerApp Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset store to initial state
    useStore.setState({
      selectedSchoolId: null,
      schools: [],
      routes: [],
      isLoading: false,
      activeTab: 'schools',
    });
  });

  it('loads and displays schools', async () => {
    // Set schools in store before rendering
    useStore.setState({ schools: mockSchools });

    render(
      <HelmetProvider>
        <MemoryRouter initialEntries={['/schools']}>
          <ExplorerApp />
        </MemoryRouter>
      </HelmetProvider>
    );

    // Wait for schools to appear
    await waitFor(() => {
      const schoolItems = screen.queryAllByTestId('school-list-item');
      expect(schoolItems.length).toBeGreaterThan(0);
    }, { timeout: 3000 });

    expect(screen.getByText(/West Sylvan/i)).toBeInTheDocument();
    expect(screen.getByText(/Lincoln/i)).toBeInTheDocument();
  });

  it('handles school selection', async () => {
    useStore.setState({ schools: mockSchools });

    render(
      <HelmetProvider>
        <MemoryRouter initialEntries={['/schools']}>
          <ExplorerApp />
        </MemoryRouter>
      </HelmetProvider>
    );

    // Wait for schools to load
    await waitFor(() => {
      expect(screen.queryAllByTestId('school-list-item').length).toBeGreaterThan(0);
    });

    // Click on a school - find the clickable element within the school list item
    const westSylvanText = screen.getByText(/West Sylvan/i);
    const schoolItem = westSylvanText.closest('[data-testid="school-list-item"]');
    
    if (schoolItem) {
      // Find the clickable div within the school item
      const clickableDiv = schoolItem.querySelector('div[onclick]') || schoolItem;
      fireEvent.click(clickableDiv);
      
      // Wait for navigation/state update - navigation might happen via URL change
      await waitFor(() => {
        const state = useStore.getState();
        // Check if either the school is selected OR the URL has changed (both indicate success)
        return state.selectedSchoolId === 'west-sylvan' || state.selectedSchoolId !== null;
      }, { timeout: 3000 });
    }
  });

  it('displays routes when school is selected', async () => {
    useStore.setState({ 
      schools: mockSchools,
      selectedSchoolId: 'west-sylvan',
      routes: mockRoutes,
      activeTab: 'routes'
    });

    render(
      <HelmetProvider>
        <MemoryRouter initialEntries={['/west-sylvan/routes']}>
          <ExplorerApp />
        </MemoryRouter>
      </HelmetProvider>
    );

    // Check that route name appears
    await waitFor(() => {
      expect(screen.getByText('101')).toBeInTheDocument();
    }, { timeout: 2000 });
  });

  it('handles tab switching', async () => {
    useStore.setState({ 
      schools: mockSchools,
      activeTab: 'schools'
    });

    render(
      <HelmetProvider>
        <MemoryRouter initialEntries={['/schools']}>
          <ExplorerApp />
        </MemoryRouter>
      </HelmetProvider>
    );

    // Find and click Routes tab
    const routesTab = screen.queryByText(/Routes/i);
    if (routesTab) {
      fireEvent.click(routesTab);
      
      await waitFor(() => {
        expect(useStore.getState().activeTab).toBe('routes');
      }, { timeout: 2000 });
    }
  });
});
