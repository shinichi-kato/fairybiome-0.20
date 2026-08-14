/**
 * TextEmbedding
 *
 * テキストの分かち書きと embedding 化を担当
 * - TinySegmenter によるトークン化
 * - 複合語マッピング（助詞の処理）
 * - Word tag マッチングと embedding 生成
 */

export class TextEmbedding {
  constructor(wordEmbedding, segmenter) {
    this.wordEmbedding = wordEmbedding;  // WordEmbedding インスタンス
    this.segmenter = segmenter;          // TinySegmenter インスタンス
  }

  /**
   * テキストを embedding オブジェクトに変換
   * @param {string} text - 入力テキスト
   * @returns {object} - {key: weight, ...}
   */
  embedText(text) {
    const tokens = this.segmentText(text);
    const features = {};

    // 逆順で処理（複合語マッピング用）
    for (let i = tokens.length - 1; i >= 0; i -= 1) {
      const token = tokens[i];

      if (!token) {
        continue;
      }

      // 助詞チェック＆複合語マッピング
      if (this._isParticle(token) && i > 0) {
        const prev = tokens[i - 1];
        const combined = `${prev}${token}`;

        // 複合語が辞書にあるか確認
        if (this.wordEmbedding.hasEmbedding(combined)) {
          const embedding = this.wordEmbedding.getEmbedding(combined);
          this._addEmbeddingToFeatures(features, embedding, 1);
          i -= 1;  // 前の要素をスキップ
          continue;
        }

        // 複合語がない場合：分割して追加
        this._addTokenWeight(features, prev, 0.5);
        this._addTokenWeight(features, combined, 0.5);
        i -= 1;  // 前の要素をスキップ
        continue;
      }

      // 通常のトークン処理
      if (this.wordEmbedding.hasEmbedding(token)) {
        const embedding = this.wordEmbedding.getEmbedding(token);
        this._addEmbeddingToFeatures(features, embedding, 1);
      } else {
        this._addTokenWeight(features, token, 1);
      }
    }

    return features;
  }

  /**
   * テキストをトークン化（TinySegmenter 使用）
   * @param {string} text - 入力テキスト
   * @returns {string[]} - トークン配列
   */
  segmentText(text) {
    if (!text || typeof text !== 'string') {
      return [];
    }

    let tokens = [];

    // TinySegmenter を使用
    if (this.segmenter && typeof this.segmenter.segment === 'function') {
      tokens = Array.from(this.segmenter.segment(text));
    } else {
      // フォールバック: 正規表現で分割
      tokens =
        text.match(/([一-龠ぁ-んァ-ヶー]+|[A-Za-z0-9]+|[^\s])/gu) || [];
    }

    // フィルタリング（句読点除外など）
    return tokens
      .map((token) => token.trim())
      .filter((token) => {
        if (token.length === 0) return false;
        if (this._isPunctuation(token)) return false;
        return true;
      });
  }

  /**
   * トークンが助詞か判定
   * @private
   */
  _isParticle(token) {
    const particles = [
      // 格助詞
      'が', 'を', 'に', 'へ', 'から', 'まで', 'より', 'の', 'で', 'も',
      // 副助詞
      'ぐらい', 'ほど', 'くらい', 'など',
      // 接続助詞
      'て', 'たり', 'ば', 'けれど', 'のに', 'が', 'のは', 'ので',
      // 主格助詞
      'は'
    ];
    return particles.includes(token);
  }

  /**
   * トークンが句読点か判定
   * @private
   */
  _isPunctuation(token) {
    const punctuation = [
      '。', '、', '！', '？', '「', '」', '『', '』',
      '.', ',', '!', '?', '"', "'", '(', ')', '[', ']'
    ];
    return punctuation.includes(token);
  }

  /**
   * Embedding を features に加算
   * @private
   */
  _addEmbeddingToFeatures(features, embedding, weight) {
    if (!embedding || typeof embedding !== 'object' || Array.isArray(embedding)) {
      return;
    }

    Object.entries(embedding).forEach(([key, value]) => {
      if (typeof value === 'number' && !Number.isNaN(value)) {
        features[key] = (features[key] || 0) + value * weight;
      }
    });
  }

  /**
   * トークンを features に重み付けで追加
   * @private
   */
  _addTokenWeight(features, token, weight) {
    if (!token || typeof token !== 'string') {
      return;
    }

    features[token] = (features[token] || 0) + weight;
  }
}

export default TextEmbedding;
