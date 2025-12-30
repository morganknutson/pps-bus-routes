import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { 
  saveRoutesToCache, 
  loadRoutesFromCache, 
  mergeCachedCoordinates 
} from './routeCache';
import { Route } from '../types';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

describe('Route Cache Service', () => {
  beforeEach(() => {
    // Replace global localStorage with mock
    Object.defineProperty(window, 'localStorage', {
      value: localStorageMock,
      writable: true,
    });
    localStorageMock.clear();
    
    // Mock console methods to avoid noise in tests
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('saveRoutesToCache', () => {
    it('saves routes to localStorage', () => {
      const routes: Route[] = [
        {
          id: 'route-1',
          name: '101',
          direction: 'Morning',
          color: '#FF0000',
          isSelected: false,
          stops: [
            { id: 'stop-1', address: '123 Main St', coordinates: [-122.6, 45.5] }
          ]
        }
      ];

      saveRoutesToCache(routes);
      
      const cached = localStorage.getItem('pps-bus-routes-cache');
      expect(cached).not.toBeNull();
      
      const parsed = JSON.parse(cached!);
      expect(parsed.version).toBe(2);
      expect(parsed.routes).toHaveLength(1);
      expect(parsed.routes[0].id).toBe('route-1');
    });

    it('removes geocoding progress from cached routes', () => {
      const routes: Route[] = [
        {
          id: 'route-1',
          name: '101',
          direction: 'Morning',
          color: '#FF0000',
          isSelected: false,
          stops: [],
          geocodingProgress: {
            total: 10,
            geocoded: 5,
            isGeocoding: true
          }
        }
      ];

      saveRoutesToCache(routes);
      
      const cached = localStorage.getItem('pps-bus-routes-cache');
      const parsed = JSON.parse(cached!);
      
      expect(parsed.routes[0].geocodingProgress).toBeUndefined();
    });

    it('handles errors gracefully', () => {
      // Mock localStorage.setItem to throw an error
      const originalSetItem = localStorage.setItem;
      localStorage.setItem = vi.fn(() => {
        throw new Error('Storage quota exceeded');
      });

      const routes: Route[] = [
        {
          id: 'route-1',
          name: '101',
          color: '#FF0000',
          isSelected: false,
          stops: []
        }
      ];

      expect(() => saveRoutesToCache(routes)).not.toThrow();
      
      // Restore original
      localStorage.setItem = originalSetItem;
    });
  });

  describe('loadRoutesFromCache', () => {
    it('returns null when cache is empty', () => {
      const result = loadRoutesFromCache();
      expect(result).toBeNull();
    });

    it('loads routes from cache', () => {
      const routes: Route[] = [
        {
          id: 'route-1',
          name: '101',
          color: '#FF0000',
          isSelected: false,
          stops: []
        }
      ];

      saveRoutesToCache(routes);
      const loaded = loadRoutesFromCache();
      
      expect(loaded).not.toBeNull();
      expect(loaded).toHaveLength(1);
      expect(loaded![0].id).toBe('route-1');
    });

    it('returns null for version mismatch', () => {
      // Save with old version
      const oldCache = {
        version: 1,
        timestamp: new Date().toISOString(),
        routes: []
      };
      localStorage.setItem('pps-bus-routes-cache', JSON.stringify(oldCache));

      const result = loadRoutesFromCache();
      expect(result).toBeNull();
      // Cache should be cleared
      expect(localStorage.getItem('pps-bus-routes-cache')).toBeNull();
    });

    it('handles corrupted cache data', () => {
      localStorage.setItem('pps-bus-routes-cache', 'invalid json');
      
      const result = loadRoutesFromCache();
      expect(result).toBeNull();
    });
  });

  describe('mergeCachedCoordinates', () => {
    it('merges coordinates from cache into routes', () => {
      // Save routes with coordinates to cache
      const cachedRoutes: Route[] = [
        {
          id: 'route-1',
          name: '101',
          color: '#FF0000',
          isSelected: false,
          stops: [
            { id: 'stop-1', address: '123 Main St', coordinates: [-122.6, 45.5] }
          ]
        }
      ];
      saveRoutesToCache(cachedRoutes);

      // Create routes without coordinates
      const routes: Route[] = [
        {
          id: 'route-1',
          name: '101',
          color: '#FF0000',
          isSelected: false,
          stops: [
            { id: 'stop-1', address: '123 Main St' }
          ]
        }
      ];

      const merged = mergeCachedCoordinates(routes);
      
      expect(merged[0].stops[0].coordinates).toEqual([-122.6, 45.5]);
    });

    it('preserves existing coordinates when cache has none', () => {
      const routes: Route[] = [
        {
          id: 'route-1',
          name: '101',
          color: '#FF0000',
          isSelected: false,
          stops: [
            { id: 'stop-1', address: '123 Main St', coordinates: [-122.7, 45.6] }
          ]
        }
      ];

      const merged = mergeCachedCoordinates(routes);
      
      expect(merged[0].stops[0].coordinates).toEqual([-122.7, 45.6]);
    });

    it('returns original routes when cache is empty', () => {
      const routes: Route[] = [
        {
          id: 'route-1',
          name: '101',
          color: '#FF0000',
          isSelected: false,
          stops: []
        }
      ];

      const merged = mergeCachedCoordinates(routes);
      
      expect(merged).toEqual(routes);
    });
  });
});

