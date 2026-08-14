/**
 * DataLoader
 *
 * JSON ファイルの読み込みとスキーマ検証を担当
 * - *.episode.json 読み込み
 * - *.embed.json (Word Tags) 読み込み
 * - タイムスタンプ管理
 * - データ検証
 */

export class DataLoader {
  constructor() {
    this.staticSource = null;
    this.firestoreSource = null;
  }

  /**
   * Word Tags ファイルを読み込み
   * @param {string} path - ファイルパス
   * @returns {Promise<object|null>}
   */
  async readWordTags(path) {
    if (!path) {
      return null;
    }

    let response;
    try {
      response = await fetch(path);
    } catch (err) {
      console.warn(`DataLoader.readWordTags: failed to fetch "${path}"`, err);
      return null;
    }

    if (!response.ok) {
      console.warn(`DataLoader.readWordTags: failed to load "${path}" (${response.status})`);
      return null;
    }

    let data;
    try {
      data = await response.json();
    } catch (err) {
      console.warn(`DataLoader.readWordTags: invalid JSON in "${path}"`, err);
      return null;
    }

    return data;
  }

  /**
   * Static ファイル（*.episode.json）を読み込み
   * @param {string} botName
   * @param {string} partName
   * @returns {Promise<object|null>}
   */
  async readStatic(botName, partName) {
    if (!botName || !partName) {
      return null;
    }

    const path = `static/bots/${botName}/${partName}.episode.json`;
    let response;

    try {
      response = await fetch(path);
    } catch (err) {
      console.warn(`DataLoader.readStatic: failed to fetch "${path}"`, err);
      return null;
    }

    if (!response.ok) {
      console.warn(`DataLoader.readStatic: failed to load "${path}" (${response.status})`);
      return null;
    }

    let data;
    try {
      data = await response.json();
    } catch (err) {
      console.warn(`DataLoader.readStatic: invalid JSON in "${path}"`, err);
      return null;
    }

    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      console.warn(`DataLoader.readStatic: "${path}" must contain an object`);
      return null;
    }

    // タイムスタンプを追加
    data.timestamp = data.timestamp !== undefined ? data.timestamp : null;

    this.staticSource = data;
    return data;
  }

  /**
   * Emotion embeddings ファイルを読み込み
   * @param {string} path - feature_emo.embed.json のパス (デフォルト: "static/common/feature_emo.embed.json")
   * @returns {Promise<object[]|null>}
   */
  async loadEmotionEmbeddings(path = 'static/common/feature_emo.embed.json') {
    if (!path || typeof path !== 'string') {
      return null;
    }

    let response;
    try {
      response = await fetch(path);
    } catch (err) {
      console.warn(`DataLoader.loadEmotionEmbeddings: failed to fetch "${path}"`, err);
      return null;
    }

    if (!response.ok) {
      console.warn(`DataLoader.loadEmotionEmbeddings: failed to load "${path}" (${response.status})`);
      return null;
    }

    let data;
    try {
      data = await response.json();
    } catch (err) {
      console.warn(`DataLoader.loadEmotionEmbeddings: invalid JSON in "${path}"`, err);
      return null;
    }

    if (!Array.isArray(data)) {
      console.warn(`DataLoader.loadEmotionEmbeddings: "${path}" must contain an array`);
      return null;
    }

    return data;
  }
  /*
   * @returns {Promise<object[]>}
   */
  async loadStaticTagFiles() {
    // NEXT_PUBLIC_STATIC_FILES から tags/*.json を抽出
    const tagFiles = [];

    if (typeof window !== 'undefined' && window.process?.env?.NEXT_PUBLIC_STATIC_FILES) {
      try {
        const files = JSON.parse(window.process.env.NEXT_PUBLIC_STATIC_FILES);
        if (Array.isArray(files)) {
          files
            .filter(f => f.includes('tags/') && f.endsWith('.json'))
            .forEach(f => tagFiles.push(f));
        }
      } catch (err) {
        console.warn('DataLoader.loadStaticTagFiles: failed to parse NEXT_PUBLIC_STATIC_FILES', err);
      }
    }

    // デフォルトのタグファイル
    const defaultTags = [
      'static/common/general.embed.json',
      'static/common/tags.embed.json',
    ];

    const results = [];
    for (const file of [...tagFiles, ...defaultTags]) {
      try {
        const data = await this.readWordTags(file);
        if (data) {
          results.push({ file, data });
        }
      } catch (err) {
        // エラーは console.warn で既に出力済み
      }
    }

    return results;
  }

  /**
   * ソースのタイムスタンプを取得
   * @returns {number}
   */
  getSourceTimestamp() {
    let maxTs = 0;

    if (this.staticSource?.timestamp) {
      maxTs = Math.max(maxTs, typeof this.staticSource.timestamp === 'number'
        ? this.staticSource.timestamp
        : new Date(this.staticSource.timestamp).getTime());
    }

    if (this.firestoreSource?.timestamp) {
      maxTs = Math.max(maxTs, typeof this.firestoreSource.timestamp === 'number'
        ? this.firestoreSource.timestamp
        : new Date(this.firestoreSource.timestamp).getTime());
    }

    return maxTs;
  }

  /**
   * JSON スキーマ検証（静的メソッド）
   * @static
   * @param {object} data - 検証対象データ
   * @returns {string} - 'ok' またはエラーメッセージ
   */
  static validateData(data) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      return 'data must be an object';
    }

    // Optional fields
    if ('title' in data && typeof data.title !== 'string') {
      return 'title must be a string';
    }
    if ('author' in data && typeof data.author !== 'string') {
      return 'author must be a string';
    }
    if ('description' in data && typeof data.description !== 'string') {
      return 'description must be a string';
    }

    // tags
    if ('tags' in data) {
      if (!Array.isArray(data.tags)) {
        return 'tags must be an array';
      }
      // 詳細検証は省略（WordEmbedding.addWordTags で実施）
    }

    // factor (required)
    if (!data.factor || typeof data.factor !== 'object' || Array.isArray(data.factor)) {
      return 'factor must be an object';
    }

    if (typeof data.factor.amplitude !== 'number' ||
        typeof data.factor.precision !== 'number' ||
        typeof data.factor.reactivity !== 'number') {
      return 'factor.amplitude, precision, reactivity must be numbers';
    }

    if (!data.factor.weight || typeof data.factor.weight !== 'object' ||
        Array.isArray(data.factor.weight)) {
      return 'factor.weight must be an object';
    }

    // columns (required)
    if (!Array.isArray(data.columns)) {
      return 'columns must be an array';
    }

    if (data.columns.length === 0) {
      return 'columns must not be empty';
    }

    if (!data.columns.every(col => typeof col === 'string')) {
      return 'all columns must be strings';
    }

    // data (required)
    if (!Array.isArray(data.data)) {
      return 'data must be an array';
    }

    return 'ok';
  }
}

export default DataLoader;
