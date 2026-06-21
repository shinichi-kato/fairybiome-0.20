import { describe, expect, it, beforeEach, vi } from 'vitest';
import { EpisodeStorage } from './EpisodeStorage';

describe('EpisodeStorage.readGlobalTags', () => {
  let originalFetch;

  beforeEach(() => {
    originalFetch = global.fetch;
    global.fetch = vi.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('loads global tags and stores them in globalTags.dict sorted by surface length', async () => {
    const sample = [
      {
        surfaces: ['兄', 'お兄さん', '兄貴'],
        embedding: { '兄': 1.0, '兄弟': 0.3, '家族': 0.1 }
      },
      {
        surfaces: ['兄弟', '姉妹'],
        embedding: { '兄弟': 1.0, '姉妹': 0.6, '家族': 0.3 }
      }
    ];

    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => sample,
    });

    const storage = new EpisodeStorage('botA');
    await storage.readGlobalTags('tags/global.json');

    expect(Object.keys(storage.globalTags.dict)).toEqual(['お兄さん', '兄貴', '兄弟', '兄', '姉妹']);
    expect(storage.globalTags.dict['お兄さん'].index).toBe(0);
    expect(storage.globalTags.dict['兄'].index).toBe(3);
    expect(storage.globalTags.dict['兄弟'].embedding['兄弟']).toBeCloseTo(0.588, 3);
  });

  it('ignores duplicate surfaces and preserves valid tags', async () => {
    const sample = [
      {
        surfaces: ['兄', 'お兄さん', '兄貴'],
        embedding: { '兄': 1.0 }
      },
      {
        surfaces: ['兄', '姉妹'],
        embedding: { '姉妹': 1.0 }
      }
    ];

    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => sample,
    });

    const storage = new EpisodeStorage('botA');
    await storage.readGlobalTags('tags/global.json');

    expect(Object.keys(storage.globalTags.dict)).toEqual(['お兄さん', '兄貴', '兄', '姉妹']);
    expect(storage.globalTags.dict['兄']).toBeDefined();
    expect(storage.globalTags.dict['姉妹']).toBeDefined();
  });

  it('does not populate globalTags.dict when fetch fails', async () => {
    global.fetch.mockRejectedValue(new Error('Network error'));

    const storage = new EpisodeStorage('botA');
    await storage.readGlobalTags('tags/global.json');

    expect(storage.globalTags.dict).toEqual({});
  });

  it('does not populate globalTags.dict when response is invalid JSON', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => { throw new Error('invalid json'); },
    });

    const storage = new EpisodeStorage('botA');
    await storage.readGlobalTags('tags/global.json');

    expect(storage.globalTags.dict).toEqual({});
  });
});
