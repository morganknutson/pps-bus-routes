import { describe, it, expect } from 'vitest';
import { 
  generateRouteColor, 
  generateRouteColorById, 
  assignUniqueColors,
  generateRouteColorByName 
} from './colorGenerator';

describe('Color Generator', () => {
  describe('generateRouteColor', () => {
    it('returns a color from the palette', () => {
      const color = generateRouteColor(0);
      expect(color).toMatch(/^#[0-9A-F]{6}$/i);
    });

    it('wraps around when index exceeds palette length', () => {
      const color1 = generateRouteColor(0);
      const color2 = generateRouteColor(40); // Should wrap to index 0
      expect(color1).toBe(color2);
    });

    it('returns different colors for different indices', () => {
      const color1 = generateRouteColor(0);
      const color2 = generateRouteColor(1);
      expect(color1).not.toBe(color2);
    });
  });

  describe('generateRouteColorById', () => {
    it('returns a consistent color for the same route ID', () => {
      const color1 = generateRouteColorById('route-101');
      const color2 = generateRouteColorById('route-101');
      expect(color1).toBe(color2);
    });

    it('returns different colors for different route IDs', () => {
      const color1 = generateRouteColorById('route-101');
      const color2 = generateRouteColorById('route-102');
      expect(color1).not.toBe(color2);
    });

    it('returns a valid hex color', () => {
      const color = generateRouteColorById('test-route');
      expect(color).toMatch(/^#[0-9A-F]{6}$/i);
    });
  });

  describe('generateRouteColorByName', () => {
    it('returns a consistent color for the same route name', () => {
      const color1 = generateRouteColorByName('100');
      const color2 = generateRouteColorByName('100');
      expect(color1).toBe(color2);
    });

    it('returns different colors for different route names', () => {
      const color1 = generateRouteColorByName('100');
      const color2 = generateRouteColorByName('200');
      expect(color1).not.toBe(color2);
    });
  });

  describe('assignUniqueColors', () => {
    it('assigns unique colors to routes', () => {
      const routes = [
        { id: 'route-1' },
        { id: 'route-2' },
        { id: 'route-3' }
      ];

      const colorMap = assignUniqueColors(routes);
      
      expect(colorMap.size).toBe(3);
      expect(colorMap.get('route-1')).toBeDefined();
      expect(colorMap.get('route-2')).toBeDefined();
      expect(colorMap.get('route-3')).toBeDefined();
    });

    it('ensures all colors are unique', () => {
      const routes = [
        { id: 'route-1' },
        { id: 'route-2' },
        { id: 'route-3' }
      ];

      const colorMap = assignUniqueColors(routes);
      const colors = Array.from(colorMap.values());
      const uniqueColors = new Set(colors);
      
      expect(uniqueColors.size).toBe(colors.length);
    });

    it('handles empty array', () => {
      const colorMap = assignUniqueColors([]);
      expect(colorMap.size).toBe(0);
    });

    it('handles single route', () => {
      const routes = [{ id: 'route-1' }];
      const colorMap = assignUniqueColors(routes);
      
      expect(colorMap.size).toBe(1);
      expect(colorMap.get('route-1')).toMatch(/^#[0-9A-F]{6}$/i);
    });
  });
});

