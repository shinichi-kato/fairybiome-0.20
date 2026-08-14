/**
 * MatrixBuilder.test.js
 *
 * MatrixBuilder の基本動作確認
 */

import { describe, expect, test } from 'vitest';
import { MatrixBuilder } from '../MatrixBuilder.js';

function createTextEmbedding() {
  return {
    embedText(text) {
      const map = {
        'hello': { hello: 1.0 },
        'world': { world: 1.0 },
        'hello world': { hello: 1.0, world: 1.0 },
      };
      return map[text] || { [text]: 1.0 };
    },
  };
}

describe('MatrixBuilder', () => {
  test('collectDataRows は separator を考慮して row を収集する', () => {
    const builder = new MatrixBuilder({ textEmbedding: createTextEmbedding() });

    const staticSource = {
      columns: ['role', 'text'],
      data: [
        ['user', 'hello'],
        'separator',
        ['bot', 'world'],
      ],
    };

    const rows = builder.collectDataRows({ staticSource, firestoreSource: null });

    expect(rows).toHaveLength(3);
    expect(rows[0].text).toBe('hello');
    expect(rows[2].text).toBe('world');
  });

  test('buildWordVectorBlocks は embedding を block として返す', () => {
    const builder = new MatrixBuilder({ textEmbedding: createTextEmbedding() });

    const rows = [
      { separator: false, index: 0, text: 'hello' },
      { separator: false, index: 1, text: 'world' },
    ];

    const { blocks, indexMap } = builder.buildWordVectorBlocks(rows);

    expect(blocks).toHaveLength(1);
    expect(indexMap).toHaveLength(1);
    expect(blocks[0][0]).toMatchObject({ hello: 1.0 });
  });

  test('buildCacheMeta は vocab と matrix を生成する', () => {
    const builder = new MatrixBuilder({ textEmbedding: createTextEmbedding() });

    const wordVector = [
      [{ hello: 1.0 }, { world: 1.0 }],
    ];

    const meta = builder.buildCacheMeta(wordVector);

    expect(meta.vocab).toContain('hello');
    expect(meta.vocab).toContain('world');
    expect(Array.isArray(meta.matrix)).toBe(true);
    expect(meta.matrix[0]).toHaveLength(meta.vocab.length);
  });
});
