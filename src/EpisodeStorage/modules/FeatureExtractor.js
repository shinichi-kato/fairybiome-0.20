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
    this.emotionToVector = this._buildEmotionToVector(emotionEmbeddings);

    // RBF kernel のセンター点（[0, 1] の正規化空間）
    this.rbfCenters = [0, 0.25, 0.5, 0.75, 1.0];
    this.rbfGamma = 1.0;  // RBF kernel の幅パラメータ
  }

  _buildEmotionToVector(emotionEmbeddings) {
    const map = {};

    if (!Array.isArray(emotionEmbeddings)) {
      return map;
    }

    emotionEmbeddings.forEach((entry) => {
      if (!entry || typeof entry !== 'object') {
        return;
      }

      // embeddings または embedding キーから sin/cos を抽出
      const emb = entry.embeddings || entry.embedding;
      if (!emb || typeof emb !== 'object') {
        return;
      }

      let sin = null;
      let cos = null;

      Object.entries(emb).forEach(([key, value]) => {
        if (typeof value !== 'number') return;

        if (key.endsWith('_sin')) {
          sin = value;
        } else if (key.endsWith('_cos')) {
          cos = value;
        }
      });

      if (sin === null || cos === null) {
        sin=0;
        cos=0;
      }

      // 角度に変換せず、[sin, cos] の配列（ベクトル）のまま保存
      const vector = [sin, cos];

      // 全ての surfaces にこのベクトルを割り当て
      if (Array.isArray(entry.surfaces)) {
        entry.surfaces.forEach((surface) => {
          if (typeof surface === 'string' && surface.trim().length > 0) {
            const cleanSurface = surface.trim();
            
            // そのまま追加
            map[cleanSurface] = vector;
            
            // 英字が含まれる場合：小文字版も追加（後方互換性）
            if (/[a-zA-Z]/.test(cleanSurface)) {
              map[cleanSurface.toLowerCase()] = vector;
            }
          }
        });
      }
    });

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
      return [0, 0];  // 中立
    }

    const emotion = emotionStr.trim();  // 大文字小文字区別なし（精密マッチ）
    return this.emotionToVector[emotion];
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
