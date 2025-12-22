import { describe, it, expect } from 'vitest';
import { 
  toLeafletPosition, 
  fromLeafletPosition, 
  validateLngLat, 
  validateLatLng, 
  calculateDistance 
} from './coordinates';

describe('Coordinate Utilities', () => {
  describe('toLeafletPosition', () => {
    it('converts [lng, lat] to [lat, lng]', () => {
      expect(toLeafletPosition([-122.676482, 45.523062])).toEqual([45.523062, -122.676482]);
    });

    it('throws error for invalid input', () => {
      expect(() => toLeafletPosition(null as any)).toThrow();
      expect(() => toLeafletPosition([1] as any)).toThrow();
    });
  });

  describe('fromLeafletPosition', () => {
    it('converts [lat, lng] to [lng, lat]', () => {
      expect(fromLeafletPosition([45.523062, -122.676482])).toEqual([-122.676482, 45.523062]);
    });
  });

  describe('validateLngLat', () => {
    it('validates correct coordinates', () => {
      expect(validateLngLat([-122.676482, 45.523062])).toBe(true);
    });

    it('rejects invalid coordinates', () => {
      expect(validateLngLat([200, 45])).toBe(false); // Invalid longitude
      expect(validateLngLat([-122, 100])).toBe(false); // Invalid latitude
      expect(validateLngLat('not an array')).toBe(false);
    });
  });

  describe('calculateDistance', () => {
    it('calculates distance between two points in meters', () => {
      const p1: [number, number] = [-122.676482, 45.523062]; // Portland
      const p2: [number, number] = [-122.6841, 45.5111]; // Near PSU
      const dist = calculateDistance(p1, p2);
      expect(dist).toBeGreaterThan(1000);
      expect(dist).toBeLessThan(2000);
    });
  });
});

