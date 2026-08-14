/**
 * FeatureExtractor.test.js
 * 
 * feature_emo.embed.json 動的読み込みのテスト
 */

import { FeatureExtractor } from '../FeatureExtractor.js';

describe('FeatureExtractor', () => {
  
  describe('_buildEmotionToAngle', () => {
    test('should build emotion map from feature_emo.embed.json format', () => {
      const emotionData = [
        {
          surfaces: ['joy', '喜び', '嬉しい'],
          embeddings: { '{emo_joy_sin}': 0, '{emo_joy_cos}': 1.0 },
          comment: '角度0度'
        },
        {
          surfaces: ['anger', '怒り', '怒ってる'],
          embedding: { '{emo_anger_sin}': -1.0, '{emo_anger_cos}': 0 },
          comment: '角度270度'
        }
      ];

      const extractor = new FeatureExtractor(emotionData);

      // 全ての surfaces が登録されていることを確認
      expect(extractor.emotionToAngle['joy']).toBeCloseTo(0, 1);
      expect(extractor.emotionToAngle['喜び']).toBeCloseTo(0, 1);
      expect(extractor.emotionToAngle['嬉しい']).toBeCloseTo(0, 1);

      expect(extractor.emotionToAngle['anger']).toBeCloseTo(270, 1);
      expect(extractor.emotionToAngle['怒り']).toBeCloseTo(270, 1);
      expect(extractor.emotionToAngle['怒ってる']).toBeCloseTo(270, 1);
    });

    test('should use default emotionToAngle when emotionEmbeddings is null', () => {
      const extractor = new FeatureExtractor(null);

      // デフォルト値が存在することを確認
      expect(extractor.emotionToAngle['joy']).toBe(0);
      expect(extractor.emotionToAngle['happy']).toBe(0);
      expect(extractor.emotionToAngle['anger']).toBe(270);
      expect(extractor.emotionToAngle['怒り']).toBe(270);
    });

    test('should handle both embeddings and embedding keys', () => {
      const emotionData = [
        {
          surfaces: ['sad'],
          embeddings: { '{emo_sad_sin}': 0, '{emo_sad_cos}': -1.0 }
        },
        {
          surfaces: ['fear'],
          embedding: { '{emo_fear_sin}': 1.0, '{emo_fear_cos}': 0 }
        }
      ];

      const extractor = new FeatureExtractor(emotionData);

      // 180度と90度を期待
      expect(extractor.emotionToAngle['sad']).toBeCloseTo(180, 1);
      expect(extractor.emotionToAngle['fear']).toBeCloseTo(90, 1);
    });
  });

  describe('extractDate', () => {
    test('should convert date to [sin, cos] vector', () => {
      const extractor = new FeatureExtractor();
      const result = extractor.extractDate('1/1');

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(2);
      expect(typeof result[0]).toBe('number');
      expect(typeof result[1]).toBe('number');
      // 1月1日は0度付近
      expect(result[0]).toBeCloseTo(0, 1);
      expect(result[1]).toBeCloseTo(1, 1);
    });

    test('should return [0, 0] for invalid date', () => {
      const extractor = new FeatureExtractor();

      expect(extractor.extractDate(null)).toEqual([0, 0]);
      expect(extractor.extractDate('')).toEqual([0, 0]);
      expect(extractor.extractDate('invalid')).toEqual([0, 0]);
    });
  });

  describe('extractTime', () => {
    test('should convert time to [sin, cos] vector', () => {
      const extractor = new FeatureExtractor();
      const result = extractor.extractTime('12:00');

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(2);
      expect(typeof result[0]).toBe('number');
      expect(typeof result[1]).toBe('number');
    });

    test('should return [0, 0] for invalid time', () => {
      const extractor = new FeatureExtractor();

      expect(extractor.extractTime(null)).toEqual([0, 0]);
      expect(extractor.extractTime('')).toEqual([0, 0]);
    });
  });

  describe('extractEmotion', () => {
    test('should convert emotion to [sin, cos] vector using dynamically built map', () => {
      const emotionData = [
        {
          surfaces: ['joy', '喜び'],
          embeddings: { '{emo_joy_sin}': 0, '{emo_joy_cos}': 1.0 }
        },
        {
          surfaces: ['anger', '怒り'],
          embedding: { '{emo_anger_sin}': -1.0, '{emo_anger_cos}': 0 }
        }
      ];

      const extractor = new FeatureExtractor(emotionData);

      // joy: 0度 → sin=0, cos=1
      const joyVec = extractor.extractEmotion('joy');
      expect(joyVec[0]).toBeCloseTo(0, 1);      // sin(0°)
      expect(joyVec[1]).toBeCloseTo(1, 1);      // cos(0°)

      // 喜び: 0度 → sin=0, cos=1
      const kiobi = extractor.extractEmotion('喜び');
      expect(kiobi[0]).toBeCloseTo(0, 1);
      expect(kiobi[1]).toBeCloseTo(1, 1);

      // anger: 270度 → sin=-1, cos=0
      const angerVec = extractor.extractEmotion('anger');
      expect(angerVec[0]).toBeCloseTo(-1, 1);   // sin(270°)
      expect(angerVec[1]).toBeCloseTo(0, 1);    // cos(270°)

      // 怒り: 270度
      const okori = extractor.extractEmotion('怒り');
      expect(okori[0]).toBeCloseTo(-1, 1);
      expect(okori[1]).toBeCloseTo(0, 1);
    });

    test('should return neutral [0, 1] for unknown emotion', () => {
      const extractor = new FeatureExtractor();
      const result = extractor.extractEmotion('unknown_emotion_xyz');

      // 中立：0度 → sin=0, cos=1
      expect(result[0]).toBeCloseTo(0, 1);
      expect(result[1]).toBeCloseTo(1, 1);
    });

    test('should handle lowercase and original case for English emotions', () => {
      const emotionData = [
        {
          surfaces: ['Joy', 'JOY'],
          embeddings: { '{emo_joy_sin}': 0, '{emo_joy_cos}': 1.0 }
        }
      ];

      const extractor = new FeatureExtractor(emotionData);

      // 元のケースで登録
      const vec1 = extractor.extractEmotion('Joy');
      expect(vec1[0]).toBeCloseTo(0, 1);
      expect(vec1[1]).toBeCloseTo(1, 1);

      // 小文字版も登録
      const vec2 = extractor.extractEmotion('joy');
      expect(vec2[0]).toBeCloseTo(0, 1);
      expect(vec2[1]).toBeCloseTo(1, 1);
    });
  });

  describe('extractContinuous', () => {
    test('should convert continuous value to RBF vector', () => {
      const extractor = new FeatureExtractor();
      const result = extractor.extractContinuous(0.5, 1.0);

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(5);  // 5つの RBF センター
      expect(result.every(v => typeof v === 'number')).toBe(true);
    });

    test('should return zero vector for invalid input', () => {
      const extractor = new FeatureExtractor();

      expect(extractor.extractContinuous(null, 1)).toEqual([0, 0, 0, 0, 0]);
      expect(extractor.extractContinuous(NaN, 1)).toEqual([0, 0, 0, 0, 0]);
    });

    test('should normalize value by maxValue', () => {
      const extractor = new FeatureExtractor();
      
      // value=50, maxValue=100 → normalized=0.5
      const result1 = extractor.extractContinuous(50, 100);
      
      // value=0.5, maxValue=1.0 → normalized=0.5
      const result2 = extractor.extractContinuous(0.5, 1.0);

      // 同じ結果になることを期待
      for (let i = 0; i < result1.length; i += 1) {
        expect(result1[i]).toBeCloseTo(result2[i], 5);
      }
    });
  });
});
