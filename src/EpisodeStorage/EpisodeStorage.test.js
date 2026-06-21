import { describe, expect, it } from 'vitest';
import { validateTags } from './EpisodeStorage';

describe('EpisodeStorage.validateTags', () => {
  it('returns ok for valid tag data', () => {
    const valid = [
      {
        surfaces: ['兄', 'お兄さん', '兄貴'],
        embedding: { '兄': 1.0, '兄弟': 0.3, '家族': 0.1 }
      },
      {
        surfaces: ['兄弟', '姉妹'],
        embedding: { '兄弟': 1.0, '姉妹': 0.6, '家族': 0.3 }
      }
    ];

    expect(validateTags(valid)).toBe('ok');
  });

  it('detects non-array root data', () => {
    expect(validateTags(null)).toEqual(['tags data must be an array']);
  });

  it('detects invalid surfaces and duplicate surfaces', () => {
    const invalid = [
      {
        surfaces: ['兄', ''],
        embedding: { '兄': 1.0 }
      },
      {
        surfaces: ['兄', '姉妹'],
        embedding: { '姉妹': 1.0 }
      }
    ];

    const result = validateTags(invalid);
    expect(Array.isArray(result)).toBe(true);
    expect(result).toContain('tag[0].surfaces[1] must not be empty');
    expect(result).toContain('tag[1].surfaces[0] is duplicated across tags: "兄"');
  });

  it('detects invalid embedding values', () => {
    const invalid = [
      {
        surfaces: ['兄'],
        embedding: { '兄': 0, '家族': 1.2 }
      }
    ];

    const result = validateTags(invalid);
    expect(result).toContain('tag[0].embedding["兄"] must be > 0 and <= 1.0');
    expect(result).toContain('tag[0].embedding["家族"] must be > 0 and <= 1.0');
  });
});
