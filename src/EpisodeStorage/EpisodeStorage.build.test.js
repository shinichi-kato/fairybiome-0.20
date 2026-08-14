import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { EpisodeStorage } from './EpisodeStorage';

async function clearEpisodeStorageDb() {
  await new Promise((resolve, reject) => {
    const request = globalThis.indexedDB.deleteDatabase('EpisodeStorage');
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => resolve();
  });
}

describe('EpisodeStorage build cache and matrix', () => {
  beforeEach(async () => {
    await clearEpisodeStorageDb();
  });

  it('builds cache metadata and stores vocab/matrix', async () => {
    const storage = new EpisodeStorage('botA');
    storage.staticSource = {
      title: '挨拶',
      author: 'skato',
      tags: [],
      factor: { activity: 0.6, precision: 0.4 },
      timestamp: 123456,
      columns: ['role', 'text', 'date', 'time', 'emo', 'facing', 'location'],
      data: [
        ['bot', 'こんにちは', '10/12', '12:23', 'laugh', 'face', 'private'],
        ['user', '今日はどう？', '10/12', '12:24', '', 'face', 'private'],
      ],
    };

    await storage.build('botA', 'greeting');

    expect(storage.cache).toBeDefined();
    expect(storage.cache.botName).toBe('botA');
    expect(storage.cache.partName).toBe('greeting');
    expect(storage.cache.timestamp).toBe(123456);
    expect(Array.isArray(storage.cache.vocab)).toBe(true);
    expect(Array.isArray(storage.cache.matrix)).toBe(true);
    expect(storage.cache.matrix.length).toBe(storage.cache.vocab.length);
    expect(storage.cache.matrix[0].length).toBe(storage.cache.vocab.length);
  });

  it('reuses a fresh cache entry instead of overwriting it', async () => {
    const storage1 = new EpisodeStorage('botA');
    storage1.staticSource = {
      title: '挨拶',
      author: 'skato',
      tags: [],
      factor: { activity: 0.6, precision: 0.4 },
      timestamp: 123456,
      columns: ['role', 'text', 'date', 'time', 'emo', 'facing', 'location'],
      data: [
        ['bot', 'こんにちは', '10/12', '12:23', 'laugh', 'face', 'private'],
        ['user', '今日はどう？', '10/12', '12:24', '', 'face', 'private'],
      ],
    };

    await storage1.build('botA', 'greeting');
    const firstTimestamp = storage1.cache.timestamp;

    const storage2 = new EpisodeStorage('botA');
    storage2.staticSource = storage1.staticSource;
    await storage2.build('botA', 'greeting');

    expect(storage2.cache).toBeDefined();
    expect(storage2.cache.timestamp).toBe(firstTimestamp);
    expect(storage2.cache.vocab).toEqual(storage1.cache.vocab);
    expect(storage2.cache.matrix).toEqual(storage1.cache.matrix);
  });

  it('exposes the modular pipeline used during build and retrieve', async () => {
    const storage = new EpisodeStorage('botA');
    storage.staticSource = {
      title: '会話',
      author: 'skato',
      tags: [],
      factor: { activity: 0.6, precision: 0.4 },
      timestamp: 123456,
      columns: ['role', 'text', 'date', 'time', 'emo', 'facing', 'location'],
      data: [
        ['bot', 'こんにちは', '10/12', '12:23', 'laugh', 'face', 'private'],
        ['user', '今日はどう？', '10/12', '12:24', '', 'face', 'private'],
        ['bot', '元気です', '10/12', '12:25', 'happy', 'face', 'private'],
      ],
    };

    await storage.build('botA', 'greeting');

    expect(storage.wordEmbedding).toBeDefined();
    expect(storage.textEmbedding).toBeDefined();
    expect(storage.matrixBuilder).toBeDefined();
    expect(storage.retriever).toBeDefined();
    expect(storage.WordTags).toBe(storage.wordEmbedding);

    const response = storage.retrieve({ text: 'こんにちは' });
    expect(response).toEqual({
      row: ['user', '今日はどう？', '10/12', '12:24', '', 'face', 'private'],
      score: expect.any(Number),
    });
  });

  it('throws a proper Error when botName or partName is missing', async () => {
    const storage = new EpisodeStorage('botA');

    await expect(storage.build()).rejects.toThrow('botNameとpartNameが指定されていない');
  });

  it('retrieves the next row after the matched line', async () => {
    const storage = new EpisodeStorage('botA');
    storage.staticSource = {
      title: '会話',
      author: 'skato',
      tags: [],
      factor: { activity: 0.6, precision: 0.4 },
      timestamp: 123456,
      columns: ['role', 'text', 'date', 'time', 'emo', 'facing', 'location'],
      data: [
        ['bot', 'こんにちは', '10/12', '12:23', 'laugh', 'face', 'private'],
        ['user', '今日はどう？', '10/12', '12:24', '', 'face', 'private'],
        ['bot', '元気です', '10/12', '12:25', 'happy', 'face', 'private'],
      ],
    };

    await storage.build('botA', 'greeting');
    const response = storage.retrieve({ text: 'こんにちは' });

    expect(response).toEqual({
      row: ['user', '今日はどう？', '10/12', '12:24', '', 'face', 'private'],
      score: expect.any(Number),
    });
  });

  it('replaces shorter tag surfaces after a longer tag match in the response', async () => {
    const storage = new EpisodeStorage('botA');
    storage.staticSource = {
      title: '会話',
      author: 'skato',
      tags: [
        {
          surfaces: ['兄', 'お兄さん', '兄貴'],
          embedding: { '兄': 1.0 },
        },
      ],
      factor: { activity: 0.6, precision: 0.4 },
      timestamp: 123456,
      columns: ['role', 'text', 'date', 'time', 'emo', 'facing', 'location'],
      data: [
        ['bot', 'おはよう', '10/12', '12:23', 'laugh', 'face', 'private'],
        ['user', 'お兄さん、元気？', '10/12', '12:24', '', 'face', 'private'],
        ['bot', 'はい、兄です', '10/12', '12:25', 'happy', 'face', 'private'],
      ],
    };

    await storage.build('botA', 'greeting');
    const response = storage.retrieve({ text: 'お兄さん' });

    expect(response).toBeDefined();
    expect(response.row[1]).toBe('はい、お兄さんです');
    expect(storage.WordTagsCache).toEqual({
      0: 'お兄さん',
    });
  });

  it('generates normalized matrix rows for cached vocabulary', () => {
    const storage = new EpisodeStorage('botA');
    const wordVector = [
      [{ a: 1, b: 0.5 }, { b: 1 }],
      [{ c: 2 }],
    ];

    const { vocab, matrix } = storage._buildCacheMeta(wordVector);

    expect(vocab).toEqual(['a', 'b', 'c']);
    expect(matrix.length).toBe(3);
    expect(matrix[0]).toEqual([1 / 1.5, 0.5 / 1.5, 0]);
    expect(matrix[1]).toEqual([0.5 / 1.75, 1.25 / 1.75, 0]);
    expect(matrix[2]).toEqual([0, 0, 1]);
  });
});
