import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import './test/mocks.tsx';
import { ExplorerApp } from './App';
import { useStore } from './store/useStore';

// Mock API data
const mockSchools = [
  {
    id: 'west-sylvan',
    name: 'West Sylvan',
    address: '1301 SW 25th Ave, Portland, OR 97201',
    coordinates: [-122.6984, 45.5123] as [number, number],
    schoolTypes: ['Middle School'] as any,
    schoolPageLink: 'http://example.com',
    driveLink: 'http://example.com/drive',
    createdAt: new Date().toISOString(),
    routeCount: 1
  },
  {
    id: 'lincoln',
    name: 'Lincoln',
    address: '1600 SW Salmon St, Portland, OR 97205',
    coordinates: [-122.6841, 45.5231] as [number, number],
    schoolTypes: ['High School'] as any,
    schoolPageLink: 'http://example.com',
    driveLink: 'http://example.com/drive',
    createdAt: new Date().toISOString(),
    routeCount: 1
  }
];

const mockRoutes = [
  {
    id: 'route-101',
    name: '101',
    direction: 'Morning',
    stops: [
      { id: 'stop-1', address: '123 Main St', coordinates: [-122.6, 45.5] as [number, number] },
      { id: 'stop-2', address: '456 Oak St', coordinates: [-122.61, 45.51] as [number, number] }
    ]
  }
];

// Mock fetch
globalThis.fetch = vi.fn().mockImplementation((url) => {
  if (url.includes('/api/schools')) {
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ schools: mockSchools })
    });
  }
  return Promise.resolve({ ok: false });
});

// Mock localRoutes service
vi.mock('./services/localRoutes', () => ({
  loadLocalRoutes: vi.fn().mockResolvedValue([
    {
      id: 'route-101',
      name: '101',
      direction: 'Morning',
      isSelected: false,
      stops: [
        { id: 'stop-1', address: '123 Main St', coordinates: [-122.6, 45.5] as [number, number] }
      ]
    }
  ])
}));

describe('ExplorerApp Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Manual reset of store data (preserving actions)
    useStore.setState({
      selectedSchoolId: null,
      schools: [],
      routes: [],
      isLoading: false,
    });
  });

  it('completes a full user interaction flow', async () => {
    render(
      <HelmetProvider>
        <MemoryRouter initialEntries={['/explore']}>
          <ExplorerApp />
        </MemoryRouter>
      </HelmetProvider>
    );

    // 1. Schools and routes properly load
    await waitFor(() => {
      expect(screen.queryAllByTestId('school-list-item').length).toBe(mockSchools.length);
    }, { timeout: 5000 });

    expect(screen.getByText(/West Sylvan/i)).toBeInTheDocument();
    expect(screen.getByText(/Lincoln/i)).toBeInTheDocument();

    // 2. Selecting/deselecting schools properly load routes and update state
    const westSylvanItem = screen.getByText(/West Sylvan/i);
    fireEvent.click(westSylvanItem);

    await waitFor(() => {
      expect(useStore.getState().selectedSchoolId).toBe('west-sylvan');
      // Should switch to routes tab
      expect(screen.getByText('101')).toBeInTheDocument();
    }, { timeout: 5000 });

    // 3. Clicking on pins/markers (we check markers appear first)
    // Note: In JSDOM with mocks, we verify markers render children of MapContainer
    const markers = await screen.findAllByTestId('map-marker');
    expect(markers.length).toBeGreaterThan(0);
    
    // Clicking a marker should deselect if it's the same one, but here we just click Lincoln
    // (We need to be on schools tab to see school markers)
    fireEvent.click(screen.getByText(/Schools/i));
    await waitFor(() => {
      expect(screen.queryAllByTestId('school-list-item').length).toBe(mockSchools.length);
    });

    const lincolnMarker = (await screen.findAllByTestId('map-marker'))[1]; // Lincoln is second
    fireEvent.click(lincolnMarker);

    await waitFor(() => {
      expect(useStore.getState().selectedSchoolId).toBe('lincoln');
    });

    // 4. Deselecting schools
    const clearButton = await screen.findByLabelText(/Clear school selection/i);
    fireEvent.click(clearButton);

    await waitFor(() => {
      expect(useStore.getState().selectedSchoolId).toBe(null);
      // Should switch back to schools tab
      expect(screen.getByText(/Schools/i)).toBeInTheDocument();
    });
  });

  it('resolves URLs to correct UI states', async () => {
    // Test direct deep link to a school's routes
    render(
      <HelmetProvider>
        <MemoryRouter initialEntries={['/west-sylvan/routes']}>
          <ExplorerApp />
        </MemoryRouter>
      </HelmetProvider>
    );

    await waitFor(() => {
      expect(useStore.getState().selectedSchoolId).toBe('west-sylvan');
      expect(screen.getByText('101')).toBeInTheDocument();
    }, { timeout: 5000 });
  });
});
