import { vi } from 'vitest';
import React from 'react';

// Mock Leaflet
vi.mock('react-leaflet', () => {
  const mockMap = {
    setView: vi.fn(),
    fitBounds: vi.fn(),
    flyToBounds: vi.fn(),
    flyTo: vi.fn(),
    project: vi.fn(() => ({ add: vi.fn(() => ({ lat: 0, lng: 0 })) })),
    unproject: vi.fn(() => ({ lat: 0, lng: 0 })),
    getContainer: vi.fn(() => ({})),
    whenReady: vi.fn((cb: any) => cb()),
    invalidateSize: vi.fn(),
    eachLayer: vi.fn((cb: any) => {
      // In tests, we don't typically have layers to iterate over,
      // but we need the function to exist.
    }),
  };

  return {
    MapContainer: require('react').forwardRef(({ children }: any, ref: any) => {
      require('react').useImperativeHandle(ref, () => mockMap, []);
      return <div data-testid="map-container">{children}</div>;
    }),
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
    Popup: ({ children }: any) => <div data-testid="popup">{children}</div>,
    Tooltip: ({ children }: any) => <div data-testid="tooltip">{children}</div>,
    ZoomControl: () => <div data-testid="zoom-control" />,
    useMap: () => mockMap,
  };
});

vi.mock('leaflet', () => {
  const Polyline = class {
    options = { color: '#000' };
    setStyle = vi.fn();
    getElement = vi.fn(() => ({ 
      style: { transition: '' }, 
      setAttribute: vi.fn() 
    }));
  };

  return {
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
        contains: vi.fn(() => true),
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
      Polyline: Polyline,
    },
    Polyline: Polyline,
    latLng: vi.fn((lat, lng) => ({ lat, lng })),
    latLngBounds: vi.fn(() => ({
      extend: vi.fn(),
      getCenter: vi.fn(),
      contains: vi.fn(() => true),
    })),
  };
});

