import { describe, expect, it } from 'vitest';
import { sanitizePostHogProperties } from './posthog';

describe('sanitizePostHogProperties', () => {
  it('redacts addresses, exact coordinates, and URL query strings', () => {
    const sanitized = sanitizePostHogProperties({
      address: '123 SW Main St, Portland, OR',
      stopAddress: 'SW Main & 12th',
      lat: 45.5152,
      longitude: -122.6784,
      url: 'https://example.com/maps?query=123%20SW%20Main',
      school_name: 'Lincoln High School',
      route_names: ['100', '200'],
      metadata: { nested: true },
    });

    expect(sanitized.address).toBeUndefined();
    expect(sanitized.stopAddress).toBeUndefined();
    expect(sanitized.lat).toBeUndefined();
    expect(sanitized.longitude).toBeUndefined();
    expect(sanitized.url).toBeUndefined();
    expect(sanitized.address_provided).toBe(true);
    expect(sanitized.stopAddress_provided).toBe(true);
    expect(sanitized.lat_provided).toBe(true);
    expect(sanitized.longitude_provided).toBe(true);
    expect(sanitized.url_provided).toBe(true);
    expect(sanitized.url_host).toBe('example.com');
    expect(sanitized.url_path).toBe('/maps');
    expect(sanitized.school_name).toBe('Lincoln High School');
    expect(sanitized.route_names).toEqual(['100', '200']);
    expect(sanitized.metadata_provided).toBe(true);
  });
});
