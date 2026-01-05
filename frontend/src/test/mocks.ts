import { vi } from 'vitest';

// Mock Leaflet
vi.mock('react-leaflet', () => ({
  MapContainer: ({ children, ref }: any) => <div data-testid="map-container" ref={ref}>{children}</div>,
  TileLayer: () => <div data-testid="tile-layer" />,
  Marker: ({ position, eventHandlers, children }: any) => (
    <div 
      data-testid="map-marker" 
      data-position={JSON.stringify(position)}
      onClick={eventHandlers?.click}
    >
      {children}
    </div>
  ),
  Polyline: () => <div data-testid="polyline" />,
  Tooltip: ({ children }: any) => <div data-testid="tooltip">{children}</div>,
  useMap: () => ({
    setView: vi.fn(),
    fitBounds: vi.fn(),
    project: vi.fn(() => ({ add: vi.fn(() => ({ lat: 0, lng: 0 })) })),
    unproject: vi.fn(() => ({ lat: 0, lng: 0 })),
    getContainer: vi.fn(() => ({})),
    whenReady: vi.fn((cb) => cb()),
    invalidateSize: vi.fn(),
  }),
}));

vi.mock('leaflet', () => ({
  default: {
    Icon: {
      Default: {
        prototype: {
          _getIconUrl: vi.fn(),
        },
      },
    },
    latLngBounds: vi.fn(() => ({
      extend: vi.fn(),
      getCenter: vi.fn(),
    })),
    Marker: {
      prototype: {
        options: {
          icon: {},
        },
      },
    },
  },
}));

