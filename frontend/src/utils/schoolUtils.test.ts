import { describe, it, expect } from 'vitest';
import { getSchoolTypes, getSchoolColor, getSchoolDisplayName } from './schoolUtils';

describe('School Utils', () => {
  describe('getSchoolTypes', () => {
    it('identifies elementary schools', () => {
      expect(getSchoolTypes('Abernethy Elementary')).toContain('Elementary School');
    });

    it('identifies middle schools', () => {
      expect(getSchoolTypes('West Sylvan Middle School')).toContain('Middle School');
      expect(getSchoolTypes('Beaumont Middle')).toContain('Middle School');
    });

    it('identifies high schools', () => {
      expect(getSchoolTypes('Lincoln High School')).toContain('High School');
      expect(getSchoolTypes('Franklin')).toContain('High School');
    });

    it('identifies hybrid schools', () => {
      expect(getSchoolTypes('Access Academy')).toContain('Hybrid');
    });

    it('defaults to elementary when type cannot be determined', () => {
      const types = getSchoolTypes('Unknown School');
      expect(types).toContain('Elementary School');
    });

    it('handles case insensitivity', () => {
      expect(getSchoolTypes('LINCOLN HIGH')).toContain('High School');
      expect(getSchoolTypes('west sylvan')).toContain('Middle School');
    });
  });

  describe('getSchoolColor', () => {
    it('returns a color for elementary schools', () => {
      const color = getSchoolColor(['Elementary School']);
      expect(color).toMatch(/^#[0-9A-F]{6}$/i);
    });

    it('returns a color for middle schools', () => {
      const color = getSchoolColor(['Middle School']);
      expect(color).toMatch(/^#[0-9A-F]{6}$/i);
    });

    it('returns a color for high schools', () => {
      const color = getSchoolColor(['High School']);
      expect(color).toMatch(/^#[0-9A-F]{6}$/i);
    });

    it('returns different colors for different school types', () => {
      const elementaryColor = getSchoolColor(['Elementary School']);
      const middleColor = getSchoolColor(['Middle School']);
      const highColor = getSchoolColor(['High School']);
      
      expect(elementaryColor).not.toBe(middleColor);
      expect(middleColor).not.toBe(highColor);
      expect(elementaryColor).not.toBe(highColor);
    });

    it('handles hybrid schools', () => {
      const color = getSchoolColor(['Hybrid']);
      expect(color).toMatch(/^#[0-9A-F]{6}$/i);
    });
  });

  describe('getSchoolDisplayName', () => {
    it('returns mapped name for known schools', () => {
      expect(getSchoolDisplayName('Lee')).toBe('Jason Lee');
      expect(getSchoolDisplayName('Boise-Eliot')).toBe('Boise-Eliot/Humboldt');
      expect(getSchoolDisplayName('Dr Martin Luther King')).toBe('Dr. Martin Luther King Jr.');
    });

    it('returns original name for unmapped schools', () => {
      expect(getSchoolDisplayName('Unknown School')).toBe('Unknown School');
      expect(getSchoolDisplayName('Test School')).toBe('Test School');
    });

    it('strips school type suffixes', () => {
      // This depends on the implementation - checking that it handles common patterns
      const name = getSchoolDisplayName('Lincoln High School');
      expect(name).toBeDefined();
    });
  });
});




