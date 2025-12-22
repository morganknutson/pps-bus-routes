import { describe, it, expect } from 'vitest';
import { parseUrlPath, buildUrlPath } from './urlState';

describe('URL State Service', () => {
  describe('parseUrlPath', () => {
    it('parses root path', () => {
      expect(parseUrlPath('/', '')).toEqual({});
    });

    it('parses school selection', () => {
      expect(parseUrlPath('/west-sylvan', '')).toEqual({
        schoolId: 'west-sylvan',
        show: 'schools'
      });
    });

    it('parses routes tab for a school', () => {
      expect(parseUrlPath('/west-sylvan/routes', '')).toEqual({
        schoolId: 'west-sylvan',
        show: 'routes'
      });
    });

    it('parses specific routes and direction', () => {
      expect(parseUrlPath('/west-sylvan/routes/morning/101,102', '')).toEqual({
        schoolId: 'west-sylvan',
        show: 'routes',
        direction: 'morning',
        routeNames: ['101', '102']
      });
    });

    it('handles explicit /schools prefix', () => {
      expect(parseUrlPath('/schools/west-sylvan', '')).toEqual({
        schoolId: 'west-sylvan',
        show: 'schools'
      });
    });

    it('handles admin base path', () => {
      expect(parseUrlPath('/admin/west-sylvan/routes', '/admin')).toEqual({
        schoolId: 'west-sylvan',
        show: 'routes'
      });
    });
  });

  describe('buildUrlPath', () => {
    it('builds school path', () => {
      expect(buildUrlPath('', { schoolId: 'west-sylvan', show: 'schools' })).toBe('/west-sylvan');
    });

    it('builds routes path', () => {
      expect(buildUrlPath('', { schoolId: 'west-sylvan', show: 'routes' })).toBe('/west-sylvan/routes');
    });

    it('builds full route path', () => {
      expect(buildUrlPath('', { 
        schoolId: 'west-sylvan', 
        show: 'routes', 
        direction: 'morning', 
        routeNames: ['101', '102'] 
      })).toBe('/west-sylvan/routes/morning/101,102');
    });
  });
});


