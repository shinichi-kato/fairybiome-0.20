import { describe, expect, it, beforeEach, vi } from 'vitest';
import { EpisodeStorage } from './EpisodeStorage';

describe('EpisodeStorage.readStatic', () => {
  let originalFetch;

  beforeEach(() => {
    originalFetch = global.fetch;
    global.fetch = vi.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('loads static JSON into staticSource and preserves timestamp when present', async () => {
    const sample = {
      title: '挨拶',
      author: 'skato',
      timestamp: 123456,
      tags: [],
      factor: { activity: 0.6, precision: 0.4 },
      columns: ['role', 'text', 'date', 'time', 'emo', 'facing', 'location'],
      data: [['bot', 'こんにちは', '10/12', '12:23', 'laugh', 'face', 'private']],
    };

    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => sample,
    });

    const storage = new EpisodeStorage('botA');
    await storage.readStatic('A', 'greeting');

    expect(storage.staticSource).toEqual(sample);
    expect(storage.staticSource.timestamp).toBe(123456);
  });

  it('defaults timestamp to null when missing', async () => {
    const sample = {
      title: '挨拶',
      author: 'skato',
      tags: [],
      factor: { activity: 0.6, precision: 0.4 },
      columns: ['role', 'text', 'date', 'time', 'emo', 'facing', 'location'],
      data: [['bot', 'こんにちは', '10/12', '12:23', 'laugh', 'face', 'private']],
    };

    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => sample,
    });

    const storage = new EpisodeStorage('botA');
    await storage.readStatic('A', 'greeting');

    expect(storage.staticSource).toEqual({ ...sample, timestamp: null });
    expect(storage.staticSource.timestamp).toBeNull();
  });
});
