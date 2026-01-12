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
        show: 'schools',
        focus: 'school-info'
      });
    });

    it('parses school info intent', () => {
      expect(parseUrlPath('/west-sylvan/school-info', '')).toEqual({
        schoolId: 'west-sylvan',
        show: 'schools',
        focus: 'school-info'
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

    it('parses a full deep link with stop selection', () => {
      expect(parseUrlPath('/forest-park/routes/morning/132/132-4', '')).toEqual({
        schoolId: 'forest-park',
        show: 'routes',
        direction: 'morning',
        routeNames: ['132'],
        stopId: '132-4'
      });
    });

    it('parses home focus intent for routes', () => {
      expect(parseUrlPath('/forest-park/routes/morning/132/home', '')).toEqual({
        schoolId: 'forest-park',
        show: 'routes',
        direction: 'morning',
        routeNames: ['132'],
        focus: 'home'
      });
    });

    it('parses full stop link with home focus', () => {
      expect(parseUrlPath('/forest-park/routes/morning/132/132-4/home', '')).toEqual({
        schoolId: 'forest-park',
        show: 'routes',
        direction: 'morning',
        routeNames: ['132'],
        stopId: '132-4',
        focus: 'home'
      });
    });

    it('parses manual camera coordinates', () => {
      expect(parseUrlPath('/forest-park/45.5,-122.6,16', '')).toEqual({
        schoolId: 'forest-park',
        show: 'schools',
        focus: '45.5,-122.6,16'
      });
    });

    it('handles explicit /schools prefix', () => {
      expect(parseUrlPath('/schools/west-sylvan', '')).toEqual({
        schoolId: 'west-sylvan',
        show: 'schools',
        focus: 'school-info'
      });
    });

    it('handles admin base path', () => {
      expect(parseUrlPath('/admin/west-sylvan/routes', '/admin')).toEqual({
        schoolId: 'west-sylvan',
        show: 'routes'
      });
    });

    it('handles neighborhoods tab', () => {
      expect(parseUrlPath('/neighborhoods', '')).toEqual({
        show: 'neighborhoods'
      });
    });
  });

  describe('buildUrlPath', () => {
    it('builds school path', () => {
      expect(buildUrlPath('', { schoolId: 'west-sylvan', show: 'schools' })).toBe('/west-sylvan');
    });

    it('builds school info path', () => {
      expect(buildUrlPath('', { schoolId: 'west-sylvan', show: 'schools', focus: 'school-info' })).toBe('/west-sylvan/school-info');
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

    it('builds full stop path with home focus', () => {
      expect(buildUrlPath('', {
        schoolId: 'forest-park',
        show: 'routes',
        direction: 'morning',
        routeNames: ['132'],
        stopId: '132-4',
        focus: 'home'
      })).toBe('/forest-park/routes/morning/132/132-4/home');
    });

    it('builds manual coordinate path', () => {
      expect(buildUrlPath('', {
        schoolId: 'forest-park',
        show: 'schools',
        focus: '45.5,-122.6,16'
      })).toBe('/forest-park/45.5,-122.6,16');
    });

    it('builds neighborhoods path', () => {
      expect(buildUrlPath('', { show: 'neighborhoods' })).toBe('/neighborhoods');
    });
  });
});
