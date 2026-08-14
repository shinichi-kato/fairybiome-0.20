/**
 * TextEmbedding.test.js
 *
 * TextEmbedding の挙動確認用テスト
 */

import { describe, expect, test } from 'vitest';
import { TextEmbedding } from '../TextEmbedding.js';

function createWordEmbedding(map) {
  return {
    hasEmbedding(surface) {
      return Object.prototype.hasOwnProperty.call(map, surface);
    },
    getEmbedding(surface) {
      return map[surface];
    },
  };
}

describe('TextEmbedding', () => {
  test('segmentText は句読点を除去してトークン化する', () => {
    const textEmbedding = new TextEmbedding(createWordEmbedding({}), {
      segment: (text) => ['学校', 'に', '行く', '。'],
    });

    const tokens = textEmbedding.segmentText('学校に行く。');

    expect(tokens).toEqual(['学校', 'に', '行く']);
  });

  test('embedText は辞書にある複合語を優先して埋め込む', () => {
    const map = {
      行く: { row: 1 },
      学校に: { row: 10, col: 20 },
    };

    const textEmbedding = new TextEmbedding(createWordEmbedding(map), {
      segment: (text) => ['学校', 'に', '行く'],
    });

    const result = textEmbedding.embedText('学校に行く');

    expect(result).toMatchObject({
      row: 11,
      col: 20,
    });
  });

  test('embedText は複合語が辞書にない場合に 0.5 / 0.5 で分割する', () => {
    const map = {
      学校: { w: 1 },
      行く: { x: 1 },
    };

    const textEmbedding = new TextEmbedding(createWordEmbedding(map), {
      segment: (text) => ['学校', 'に', '行く'],
    });

    const result = textEmbedding.embedText('学校に行く');

    expect(result).toMatchObject({
      学校: 0.5,
      '学校に': 0.5,
      x: 1,
    });
  });

  test('embedText は辞書にない単語を重み付きで加算する', () => {
    const map = {
      こんにちは: { greeting: 1 },
    };

    const textEmbedding = new TextEmbedding(createWordEmbedding(map), {
      segment: (text) => ['今日は', 'いい', '天気', 'です'],
    });

    const result = textEmbedding.embedText('今日はいい天気です');

    expect(result).toMatchObject({
      '今日は': 1,
      'いい': 1,
      '天気': 1,
      'です': 1,
    });
  });
});
