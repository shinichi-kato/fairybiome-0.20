/**
 * AttentionEmbedding
 *
 * Attention 機構によるベクトル重み付けを担当
 * - Softmax ベースの重み計算
 * - ベクトルの内積（スコア）計算
 * - 重み付きベクトル加算
 */

export class AttentionEmbedding {
  constructor() {
    // パラメータなし（純粋な演算）
  }

  /**
   * 全ブロックに対して Attention ベクトルを計算
   * @param {object[][][]} wordVector - ブロック × 行 × embedding オブジェクト
   * @returns {object[][][]} - context ベクトルのブロック
   */
  buildAttentionVectors(wordVector) {
    if (!Array.isArray(wordVector)) {
      return [];
    }

    return wordVector.map((block) => {
      if (!Array.isArray(block)) {
        return [];
      }

      const contexts = [];

      for (let n = 0; n < block.length; n += 1) {
        const x_n = block[n];

        if (!x_n || typeof x_n !== 'object') {
          contexts.push({});
          continue;
        }

        // ステップ 1: スコア計算
        const scores = [];
        for (let i = 0; i < n; i += 1) {
          const score = this.vectorDot(x_n, block[i]);
          scores.push(score);
        }

        // ステップ 2: Softmax で重み計算
        const alphas = this.softmax(scores);

        // ステップ 3: Context ベクトル生成
        let context = {};
        for (let i = 0; i < n; i += 1) {
          if (alphas[i] > 0) {
            context = this.addVector(context, block[i], alphas[i]);
          }
        }

        contexts.push(context);
      }

      return contexts;
    });
  }

  /**
   * ベクトルの内積（スコア計算）
   * @param {object} a - embedding オブジェクト {key: value, ...}
   * @param {object} b - embedding オブジェクト
   * @returns {number} - ドット積
   */
  vectorDot(a, b) {
    if (!a || !b || typeof a !== 'object' || typeof b !== 'object') {
      return 0;
    }

    let sum = 0;

    Object.entries(a).forEach(([key, value]) => {
      if (typeof value !== 'number' || Number.isNaN(value)) {
        return;
      }

      const otherValue = b[key];
      if (typeof otherValue === 'number' && !Number.isNaN(otherValue)) {
        sum += value * otherValue;
      }
    });

    return sum;
  }

  /**
   * Softmax 関数（数値安定性対策済み）
   * @param {number[]} scores - スコアの配列
   * @returns {number[]} - 正規化された重み（合計 1）
   */
  softmax(scores) {
    if (!Array.isArray(scores) || scores.length === 0) {
      return [];
    }

    // 数値安定性: 最大値を引く
    const maxScore = Math.max(...scores);
    const exps = scores.map((score) => Math.exp(score - maxScore));
    const sum = exps.reduce((acc, value) => acc + value, 0);

    if (sum === 0) {
      // すべてが 0 の場合は均等
      return exps.map(() => 1 / scores.length);
    }

    return exps.map((value) => value / sum);
  }

  /**
   * ベクトルを加算（重み付け）
   * @param {object} base - ベースベクトル
   * @param {object} vector - 加算するベクトル
   * @param {number} scale - スケーリング係数（重み）
   * @returns {object} - 加算済みベクトル
   */
  addVector(base, vector, scale = 1) {
    if (!vector || typeof vector !== 'object' || Array.isArray(vector)) {
      return base;
    }

    const result = { ...base };

    Object.entries(vector).forEach(([key, value]) => {
      if (typeof value === 'number' && !Number.isNaN(value)) {
        result[key] = (result[key] || 0) + value * scale;
      }
    });

    return result;
  }

  /**
   * ベクトルのノルム（大きさ）を計算
   * @param {object} vector - embedding オブジェクト
   * @returns {number} - L2 ノルム
   */
  vectorNorm(vector) {
    if (!vector || typeof vector !== 'object') {
      return 0;
    }

    let sum = 0;
    Object.values(vector).forEach((value) => {
      if (typeof value === 'number' && !Number.isNaN(value)) {
        sum += value * value;
      }
    });

    return Math.sqrt(sum);
  }

  /**
   * ベクトルを正規化（ノルムが 1 になるように）
   * @param {object} vector - embedding オブジェクト
   * @returns {object} - 正規化済みベクトル
   */
  normalizeVector(vector) {
    if (!vector || typeof vector !== 'object') {
      return {};
    }

    const norm = this.vectorNorm(vector);

    if (norm === 0) {
      return vector;  // 零ベクトルは変更なし
    }

    const result = {};
    Object.entries(vector).forEach(([key, value]) => {
      if (typeof value === 'number' && !Number.isNaN(value)) {
        result[key] = value / norm;
      }
    });

    return result;
  }
}

export default AttentionEmbedding;
