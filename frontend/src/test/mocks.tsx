import { vi } from 'vitest';
import React from 'react';

// Mock Leaflet
vi.mock('react-leaflet', () => {
  return {
    MapContainer: ({ children }: any) => <div data-testid="map-container">{children}</div>,
    TileLayer: () => <div data-testid="tile-layer" />,
    Marker: ({ eventHandlers, children }: any) => (
      <div 
        data-testid="map-marker" 
        onClick={eventHandlers?.click}
      >
        {children}
      </div>
    ),
    Polyline: () => <div data-testid="polyline" />,
    Tooltip: ({ children }: any) => <div data-testid="tooltip">{children}</div>,
    ZoomControl: () => <div data-testid="zoom-control" />,
    useMap: () => ({
      setView: vi.fn(),
      fitBounds: vi.fn(),
      project: vi.fn(() => ({ add: vi.fn(() => ({ lat: 0, lng: 0 })) })),
      unproject: vi.fn(() => ({ lat: 0, lng: 0 })),
      getContainer: vi.fn(() => ({})),
      whenReady: vi.fn((cb) => cb()),
      invalidateSize: vi.fn(),
    }),
  };
});

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
    divIcon: vi.fn(() => ({})),
    latLng: vi.fn((lat, lng) => ({ lat, lng })),
  },
}));

