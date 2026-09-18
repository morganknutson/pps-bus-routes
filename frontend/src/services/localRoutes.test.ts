import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadLocalRoutes } from './localRoutes';

const route = (filename: string, direction = 'Morning') => ({
  id: filename, name: '112', direction, filename, stops: [],
});

describe('effective route selection', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 18, 12));
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('selects September 2026 over lowercase 2025 and earlier capitalized revisions, regardless of response order', async () => {
    const routes = [
      route('112AIN-A_effective_111225.pdf'),
      route('112AIN-A_Effective_091626.pdf'),
      route('112AIN-A_Effective_090926.pdf'),
      route('112AIN-P_Effective_091626.pdf', 'Afternoon'),
    ];
    for (const response of [routes, [...routes].reverse()]) {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ routes: response }) }));
      const selected = await loadLocalRoutes('ainsworth');
      expect(selected).toHaveLength(2);
      expect(selected.every(r => r.filename?.includes('091626'))).toBe(true);
    }
  });

  it('keeps future versions separate until their effective date', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ routes: [
      route('112AIN-A_Effective_091626.pdf'), route('112AIN-A_Effective_092326.pdf'),
    ] }) }));
    const selected = await loadLocalRoutes('ainsworth');
    expect(selected.find(r => r.name === '112')?.filename).toContain('091626');
    expect(selected.find(r => r.name === '112-upcoming')?.filename).toContain('092326');
  });
});
