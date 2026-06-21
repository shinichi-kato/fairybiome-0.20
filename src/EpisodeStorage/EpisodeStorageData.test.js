import { describe, expect, it } from 'vitest';
import { validateData } from './EpisodeStorage';

describe('EpisodeStorage.validateData', () => {
  it('returns ok for valid episode data', () => {
    const valid = {
      title: '挨拶',
      author: 'skato',
      tags: [
        {
          surfaces: ['兄', 'お兄さん', '兄貴'],
          embedding: { '兄': 1.0, '兄弟': 0.3 }
        }
      ],
      factor: {
        activity: 0.6,
        precision: 0.4
      },
      columns: ['role', 'text', 'date', 'time', 'emo', 'facing', 'location'],
      data: [
        '# コメント',
        ['bot', 'こんにちは', '10/12', '12:23', 'laugh', 0, 'indoor'],
        ['user', '今日はどう？', '10/12', '12:24', '', 0, 'indoor'],
        null
      ]
    };

    expect(validateData(valid)).toBe('ok');
  });

  it('rejects invalid data structure and values', () => {
    const invalid = {
      title: 123,
      author: null,
      tags: 'not-an-array',
      factor: {
        activity: 1.2,
        precision: 'high'
      },
      columns: ['role', 'text'],
      data: [['bot', '', '13/32', '24:00', 'unknown', 'left', 'outside']]
    };

    const result = validateData(invalid);
    expect(result).toContain('title must be a string');
    expect(result).toContain('author must be a string');
    expect(result).toContain('tags.tags data must be an array');
    expect(result).toContain('factor.activity must be > 0 and <= 1.0');
    expect(result).toContain('factor.precision must be a number');
    expect(result).toContain('data[0] length must match columns length (2)');
  });
});
