import { describe, expect, it, beforeEach, vi } from 'vitest';
import { EpisodeStorage } from './EpisodeStorage';

describe('EpisodeStorage.readWordTags', () => {
  let originalFetch;

  beforeEach(() => {
    originalFetch = global.fetch;
    global.fetch = vi.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    delete process.env.NEXT_PUBLIC_STATIC_FILES;
  });

  it('loads all tag JSON files under tags/ when deployFromJson is used', async () => {
    process.env.NEXT_PUBLIC_STATIC_FILES = JSON.stringify(['tags/alpha.json', 'tags/beta.json', 'docs/ignore.json']);
    global.fetch
      .mockResolvedValueOnce({ ok: true, json: async () => [{ surfaces: ['A'], embedding: { A: 1.0 } }] })
      .mockResolvedValueOnce({ ok: true, json: async () => [{ surfaces: ['B'], embedding: { B: 1.0 } }] });

    const storage = new EpisodeStorage('botA');
    await storage.deployFromJson('botA', 'partA');

    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(global.fetch.mock.calls.map(([path]) => path)).toEqual(['tags/alpha.json', 'tags/beta.json']);
    expect(Object.keys(storage.WordTags.dict)).toEqual(['A', 'B']);
  });

  it('loads global tags and stores them in WordTags.dict sorted by surface length', async () => {
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
    await storage.readWordTags('tags/global.json');

    expect(Object.keys(storage.WordTags.dict)).toEqual(['お兄さん', '兄貴', '兄弟', '姉妹', '兄']);
    expect(storage.WordTags.dict['お兄さん'].index).toBe(0);
    expect(storage.WordTags.dict['兄'].index).toBe(4);
    expect(storage.WordTags.dict['兄弟'].embedding['兄弟']).toBeCloseTo(0.526, 3);
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
    await storage.readWordTags('tags/global.json');

    expect(Object.keys(storage.WordTags.dict)).toEqual(['お兄さん', '兄貴', '姉妹', '兄']);
    expect(storage.WordTags.dict['兄']).toBeDefined();
    expect(storage.WordTags.dict['姉妹']).toBeDefined();
  });

  it('does not populate WordTags.dict when fetch fails', async () => {
    global.fetch.mockRejectedValue(new Error('Network error'));

    const storage = new EpisodeStorage('botA');
    await storage.readWordTags('tags/global.json');

    expect(storage.WordTags.dict).toEqual({});
  });

  it('does not populate WordTags.dict when response is invalid JSON', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => { throw new Error('invalid json'); },
    });

    const storage = new EpisodeStorage('botA');
    await storage.readWordTags('tags/global.json');

    expect(storage.WordTags.dict).toEqual({});
  });

  it('can reuse addWordTags for tag arrays and preserves existing entries', () => {
    const storage = new EpisodeStorage('botA');
    storage.addWordTags([
      {
        surfaces: ['兄', 'お兄さん'],
        embedding: { '兄': 1.0 }
      }
    ], 'inline');

    expect(Object.keys(storage.WordTags.dict)).toEqual(['お兄さん', '兄']);
    expect(storage.WordTags.dict['お兄さん'].index).toBe(0);
    expect(storage.WordTags.dict['兄'].embedding['兄']).toBeCloseTo(1.0, 5);

    storage.addWordTags([
      {
        surfaces: ['兄', '姉妹'],
        embedding: { '姉妹': 1.0 }
      }
    ], 'inline2');

    expect(Object.keys(storage.WordTags.dict)).toEqual(['お兄さん', '兄', '姉妹']);
    expect(storage.WordTags.dict['姉妹'].index).toBe(2);
  });
});
