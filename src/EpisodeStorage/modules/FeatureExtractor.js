/**
 * FeatureExtractor
 *
 * 各特徴量タイプの単位ベクトル化を担当
 * - 周期的特徴量：date, time, emo → [sin, cos] または emotion embedding
 * - 連続値特徴量：barometer → RBF kernel vector
 *
 * @param {object[]|null} emotionEmbeddings - feature_emo.embed.json のコンテンツ
 */

export class FeatureExtractor {
  constructor(emotionEmbeddings = null) {
    // 感情 → 角度のマッピング（feature_emo.embed.json から動的に構築）
    this.emotionToAngle = this._buildEmotionToAngle(emotionEmbeddings);

    // RBF kernel のセンター点（[0, 1] の正規化空間）
    this.rbfCenters = [0, 0.25, 0.5, 0.75, 1.0];
    this.rbfGamma = 1.0;  // RBF kernel の幅パラメータ
  }

  /**
   * feature_emo.embed.json から emotionToAngle マップを構築
   * @private
   * @param {object[]|null} emotionEmbeddings - JSON配列またはnull
   * @returns {object} - {surface: angle_deg, ...}
   */
  _buildEmotionToAngle(emotionEmbeddings) {
    const map = {};

    if (Array.isArray(emotionEmbeddings)) {
      emotionEmbeddings.forEach((entry) => {
        if (!entry || typeof entry !== 'object') {
          return;
        }

        // embeddings または embedding キーから sin/cos を抽出
        const emb = entry.embeddings || entry.embedding;
        if (!emb || typeof emb !== 'object') {
          return;
        }

        // {emo_*_sin}, {emo_*_cos} パターンから値を抽出
        let sin = 0;
        let cos = 1; // デフォルトは 0度

        Object.entries(emb).forEach(([key, value]) => {
          if (typeof value !== 'number') return;

          if (key.includes('_sin')) {
            sin = value;
          } else if (key.includes('_cos')) {
            cos = value;
          }
        });

        // atan2(sin, cos) → ラジアン → 度数（0-360）
        const angleRad = Math.atan2(sin, cos);
        const angleDeg = (angleRad * 180 / Math.PI + 360) % 360;

        // 全ての surfaces にこの角度を割り当て
        // 英語は小文字でも大文字でもマッチするようにする
        if (Array.isArray(entry.surfaces)) {
          entry.surfaces.forEach((surface) => {
            if (typeof surface === 'string' && surface.length > 0) {
              // そのまま追加
              map[surface] = angleDeg;
              // 英語のみ：小文字版も追加（後方互換性）
              if (/^[a-z]+$/i.test(surface)) {
                map[surface.toLowerCase()] = angleDeg;
              }
            }
          });
        }
      });
    }

    // デフォルト（フォールバック）
    if (Object.keys(map).length === 0) {
      return {
        // 英名（8基本感情）
        'joy': 0,
        'trust': 45,
        'fear': 90,
        'surprise': 135,
        'sadness': 180,
        'disgust': 225,
        'anger': 270,
        'anticipation': 315,
        
        // 英語エイリアス
        'happy': 0,
        'laugh': 0,
        'sad': 180,
        'angry': 270,
        'afraid': 90,
        'surprised': 135,
        'disgusted': 225,
        'anticipate': 315,

        // 日本語（基本感情と同義語）
        '喜び': 0,
        '嬉しい': 0,
        '楽しい': 0,
        'たのしい': 0,
        '信頼': 45,
        '信じる': 45,
        '信用してる': 45,
        '怖い': 90,
        '恐い': 90,
        '恐れてる': 90,
        '恐ろしい': 90,
        '恐怖': 90,
        '不安': 90,
        '驚き': 135,
        'びっくり': 135,
        '驚いた': 135,
        '悲しい': 180,
        '悲しみ': 180,
        '悲哀': 180,
        '嫌悪': 225,
        '嫌い': 225,
        'おぞましい': 225,
        '怒り': 270,
        '怒ってる': 270,
        'ムカつく': 270,
        '腹たつ': 270,
        '期待': 315,
        '気になる': 315,
        '警戒': 315,
      };
    }

    return map;
  }

  /**
   * Date （日付）→ [sin, cos] ベクトル化
   * @param {string} dateStr - 日付文字列 (例: "10/12", "10/12/2024")
   * @returns {number[]} - [sin(theta), cos(theta)]
   */
  extractDate(dateStr) {
    if (!dateStr || typeof dateStr !== 'string') {
      return [0, 0];
    }

    const parts = dateStr.split('/').map(p => parseInt(p, 10));
    if (parts.length < 2) {
      return [0, 0];
    }

    const month = parts[0] || 1;
    const day = parts[1] || 1;

    // 1 年 = 2π に正規化
    // 月を 30 日単位、日を日単位で推定
    const dayOfYear = (month - 1) * 30 + day;
    const theta = (dayOfYear / 365) * 2 * Math.PI;

    return [Math.sin(theta), Math.cos(theta)];
  }

  /**
   * Time （時刻）→ [sin, cos] ベクトル化
   * @param {string} timeStr - 時刻文字列 (例: "12:23", "12:23:45")
   * @returns {number[]} - [sin(theta), cos(theta)]
   */
  extractTime(timeStr) {
    if (!timeStr || typeof timeStr !== 'string') {
      return [0, 0];
    }

    const parts = timeStr.split(':').map(p => parseInt(p, 10));
    if (parts.length < 2) {
      return [0, 0];
    }

    const hours = parts[0] || 0;
    const minutes = parts[1] || 0;
    const seconds = parts[2] || 0;

    // 秒単位で計算
    const totalSeconds = hours * 3600 + minutes * 60 + seconds;

    // 1 日 = 86400 秒 = 2π に正規化
    const theta = (totalSeconds / 86400) * 2 * Math.PI;

    return [Math.sin(theta), Math.cos(theta)];
  }

  /**
   * Emotion （感情）→ [sin, cos] ベクトル化
   * emotionToAngle から角度を取得し、ラジアン変換して sin/cos を返す
   * @param {string} emotionStr - 感情ラベル (例: "happy", "sad", "喜び")
   * @returns {number[]} - [sin(theta), cos(theta)]
   */
  extractEmotion(emotionStr) {
    if (!emotionStr || typeof emotionStr !== 'string') {
      return [0, 1];  // 中立：0度
    }

    const emotion = emotionStr.trim();  // 大文字小文字区別なし（精密マッチ）
    let angleDeg = this.emotionToAngle[emotion];

    if (typeof angleDeg !== 'number') {
      // 未登録の感情は中立 (0度) にマップ
      angleDeg = 0;
    }

    // 度数 → ラジアン
    const theta = angleDeg * Math.PI / 180;

    return [Math.sin(theta), Math.cos(theta)];
  }

  /**
   * Continuous value （連続値）→ RBF kernel ベクトル化
   * @param {number} value - 値 (例: 気圧)
   * @param {number} maxValue - 最大値（正規化用）
   * @returns {number[]} - RBF ベクトル（デフォルト 5 次元）
   */
  extractContinuous(value, maxValue = 1.0) {
    if (typeof value !== 'number' || Number.isNaN(value)) {
      return this.rbfCenters.map(() => 0);
    }

    // 正規化
    const normalized = maxValue > 0 ? value / maxValue : 0;
    const clamped = Math.max(0, Math.min(1, normalized));

    // RBF 計算
    return this.rbfCenters.map(center =>
      Math.exp(-this.rbfGamma * (clamped - center) ** 2)
    );
  }

  /**
   * 度数（0-360）をラジアンに変換
   * @private
   */
  degreesToRadians(degrees) {
    return (degrees / 360) * 2 * Math.PI;
  }

  /**
   * RBF kernel 関数
   * @private
   */
  rbfKernel(x, center, gamma = this.rbfGamma) {
    return Math.exp(-gamma * (x - center) ** 2);
  }
}

export default FeatureExtractor;
