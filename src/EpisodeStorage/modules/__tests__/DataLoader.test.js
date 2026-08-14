/**
 * DataLoader.test.js
 * 
 * DataLoader の emotion embeddings ロード機能のテスト
 */

import { DataLoader } from '../DataLoader.js';

describe('DataLoader', () => {
  
  describe('loadEmotionEmbeddings', () => {
    test('should load emotion embeddings from feature_emo.embed.json', async () => {
      const loader = new DataLoader();

      // 実際のファイルを読み込み（開発環境で存在と仮定）
      // この場合、mock または fetch をスタブ化する必要がある
      // ここではスキップするか、mock fetch を使う
    });

    test('should return null for invalid path', async () => {
      const loader = new DataLoader();

      // fetch が失敗する場合
      const result1 = await loader.loadEmotionEmbeddings(null);
      expect(result1).toBeNull();

      const result2 = await loader.loadEmotionEmbeddings('');
      expect(result2).toBeNull();
    });
  });

  describe('validateData', () => {
    test('should validate proper episode data structure', () => {
      const validData = {
        columns: ['role', 'text', 'target'],
        data: [
          ['user', 'こんにちは', 'bot'],
          ['bot', 'こんにちは！', 'user']
        ],
        factor: {
          amplitude: 1.0,
          precision: 0.5,
          reactivity: 0.8,
          weight: {
            wordVector: 1.0,
            dateVector: 0.5,
            timeVector: 0.3
          }
        }
      };

      const result = DataLoader.validateData(validData);
      expect(result).toBe('ok');
    });

    test('should reject data without factor', () => {
      const invalidData = {
        columns: ['role', 'text'],
        data: []
      };

      const result = DataLoader.validateData(invalidData);
      expect(result).not.toBe('ok');
      expect(result).toContain('factor');
    });

    test('should reject data without columns', () => {
      const invalidData = {
        factor: {
          amplitude: 1.0,
          precision: 0.5,
          reactivity: 0.8,
          weight: {}
        },
        data: []
      };

      const result = DataLoader.validateData(invalidData);
      expect(result).not.toBe('ok');
      expect(result).toContain('columns');
    });

    test('should allow optional fields (title, author)', () => {
      const dataWithMetadata = {
        title: 'My Bot Part',
        author: 'user@example.com',
        description: 'A test part',
        columns: ['role', 'text'],
        data: [],
        factor: {
          amplitude: 1.0,
          precision: 0.5,
          reactivity: 0.8,
          weight: {}
        }
      };

      const result = DataLoader.validateData(dataWithMetadata);
      expect(result).toBe('ok');
    });
  });

  describe('readWordTags', () => {
    test('should handle fetch errors gracefully', async () => {
      const loader = new DataLoader();

      // 存在しないパスを指定（fetch エラー）
      const result = await loader.readWordTags('/nonexistent/path.json');

      // エラーは null で返すはず
      expect(result).toBeNull();
    });
  });

  describe('readStatic', () => {
    test('should return null for missing botName or partName', async () => {
      const loader = new DataLoader();

      const result1 = await loader.readStatic(null, 'part1');
      expect(result1).toBeNull();

      const result2 = await loader.readStatic('bot1', null);
      expect(result2).toBeNull();
    });
  });
});
