/**
 * WordEmbedding
 *
 * Word tag 辞書管理と embedding の処理を担当
 * - 単語サーフェス → embedding のマッピング
 * - embedding の正規化
 * - タググループ管理
 */

export class WordEmbedding {
  constructor() {
    /**
     * dict: surface → {index, embedding, groupId}
     * - surface: 単語の表層形 (例: "兄", "お兄さん")
     * - index: 辞書内のインデックス
     * - embedding: {concept: weight, ...}
     * - groupId: 同じ embedding を共有するグループ ID
     */
    this.dict = {};

    /**
     * groups: groupId → {surfaces}
     * - 複数のサーフェスが同じ embedding を共有するグループ
     */
    this.groups = {};

    this.nextGroupId = 0;
  }

  /**
   * タグデータを辞書に追加
   * @param {object[]} data - タグ配列 [{surfaces: [...], embedding: {...}}, ...]
   * @param {string} source - ソース識別 (ファイルパスなど)
   */
  addWordTags(data, source = 'inline') {
    if (!Array.isArray(data)) {
      console.warn(`WordEmbedding.addWordTags: "${source}" must contain an array`);
      return;
    }

    const seenSurface = new Set(Object.keys(this.dict));
    const normalizedSurfaces = [];

    data.forEach((item, idx) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) {
        console.warn(
          `WordEmbedding.addWordTags: invalid tag item at index ${idx} in "${source}"`
        );
        return;
      }

      const { surfaces, embedding } = item;

      if (!Array.isArray(surfaces)) {
        console.warn(
          `WordEmbedding.addWordTags: tag[${idx}].surfaces must be an array in "${source}"`
        );
        return;
      }

      if (!embedding || typeof embedding !== 'object' || Array.isArray(embedding)) {
        console.warn(
          `WordEmbedding.addWordTags: tag[${idx}].embedding must be an object in "${source}"`
        );
        return;
      }

      const normalizedEmbedding = this.normalizeEmbedding(embedding);
      if (!normalizedEmbedding) {
        console.warn(
          `WordEmbedding.addWordTags: tag[${idx}].embedding is invalid in "${source}"`
        );
        return;
      }

      const groupId = this.nextGroupId++;
      const groupSurfaces = [];

      surfaces.forEach((surface) => {
        if (typeof surface !== 'string' || !surface.trim().length) {
          console.warn(
            `WordEmbedding.addWordTags: invalid surface in tag[${idx}] in "${source}"`
          );
          return;
        }

        if (seenSurface.has(surface)) {
          console.warn(
            `WordEmbedding.addWordTags: duplicate surface "${surface}" ignored in "${source}"`
          );
          return;
        }

        seenSurface.add(surface);
        normalizedSurfaces.push({ surface, embedding: normalizedEmbedding, groupId });
        groupSurfaces.push(surface);
      });

      if (groupSurfaces.length > 0) {
        this.groups[groupId] = { surfaces: groupSurfaces };
      }
    });

    // サーフェスを長さでソート（長い順）
    normalizedSurfaces.sort((a, b) => {
      const diff = b.surface.length - a.surface.length;
      return diff !== 0 ? diff : a.surface.localeCompare(b.surface);
    });

    // 辞書を更新
    const updatedDict = { ...this.dict };
    const baseIndex = Object.keys(this.dict).length;

    normalizedSurfaces.forEach((item, index) => {
      updatedDict[item.surface] = {
        index: baseIndex + index,
        embedding: item.embedding,
        groupId: item.groupId,
      };
    });

    this.dict = updatedDict;
  }

  /**
   * Embedding を正規化（合計が 1 になるように）
   * @param {object} embedding - {key: value, ...}
   * @returns {object|null} - 正規化済み embedding、またはエラー時 null
   */
  normalizeEmbedding(embedding) {
    if (!embedding || typeof embedding !== 'object' || Array.isArray(embedding)) {
      return null;
    }

    const sum = Object.values(embedding).reduce((acc, val) => {
      if (typeof val === 'number' && !Number.isNaN(val)) {
        return acc + val;
      }
      return acc;
    }, 0);

    if (sum <= 0) {
      return null;
    }

    const normalized = {};
    Object.entries(embedding).forEach(([key, val]) => {
      if (typeof val === 'number' && !Number.isNaN(val)) {
        normalized[key] = val / sum;
      }
    });

    return normalized;
  }

  /**
   * サーフェスから embedding を取得
   * @param {string} surface - 単語サーフェス
   * @returns {object|undefined} - embedding オブジェクト
   */
  getEmbedding(surface) {
    const entry = this.dict[surface];
    return entry ? entry.embedding : undefined;
  }

  /**
   * サーフェスが辞書に存在するか確認
   * @param {string} surface - 単語サーフェス
   * @returns {boolean}
   */
  hasEmbedding(surface) {
    return surface in this.dict;
  }

  /**
   * グループに属するすべてのサーフェスを取得
   * @param {number} groupId - グループ ID
   * @returns {string[]}
   */
  getSurfacesInGroup(groupId) {
    const group = this.groups[groupId];
    return group ? group.surfaces : [];
  }

  /**
   * 辞書の統計情報
   * @returns {object}
   */
  getStats() {
    return {
      totalSurfaces: Object.keys(this.dict).length,
      totalGroups: Object.keys(this.groups).length,
      nextGroupId: this.nextGroupId,
    };
  }
}

export default WordEmbedding;
