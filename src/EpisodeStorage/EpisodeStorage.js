// * dateなどの特徴量は正しく計算が実装されているか？
// * ハイパーパラメータの取り扱いが見つからない

import Dexie from 'dexie';
import { TinySegmenter } from '../../_legacy/biomebot-021/tinysegmenter.js';

export class EpisodeStorage {
  constructor(firestore_token) {
    this._db = new Dexie("EpisodeStorage");
    this._db.version(1).stores({
      firestoreSources: "++id,path",
      caches: "botName,partName",
    });
    this._db.version(2).stores({
      firestoreSources: "++id,path",
      caches: "[botName+partName],botName,partName",
    });
    this.botName = null;
    this.partName = null;
    this.factor = null;
    this.data;
    this.firestore_token = firestore_token;
    this.staticSource = null;
    this.firestoreSource = null;
    this.cache = null;
    this.attentionVectors = null;
    this.wordVector = [];
    this.indexMap = [];
    this.dataRows = [];
    this.messageHistory = [];
    this.WordTags = { dict: {}, groups: {}, nextGroupId: 0 };
    this.WordTagsCache = {};
    this._segmenter = new TinySegmenter();
  }

  async deploy(botName,partName, data=null){
    // dataが供給された場合それを優先
    this.botName=botName;
    this.partName=partName;
    if(!!data){
      await this.readStatic(botName,partName);
    }
    else {
      this.staticSource=data;
    }

    return await this.build(botName, partName);
  }

  async deployFromJson(botName, partName){
    this.botName = botName;
    this.partName = partName;
    await this._loadStaticTagFiles();
  }

  async readWordTags(path){
      if (!path) {
        return;
      }

      let response;
      try {
        response = await fetch(path);
      } catch (err) {
        console.warn(`EpisodeStorage.readWordTags: failed to fetch "${path}"`, err);
        return;
      }

      if (!response.ok) {
        console.warn(`EpisodeStorage.readWordTags: failed to load "${path}" (${response.status})`);
        return;
      }

      let data;
      try {
        data = await response.json();
      } catch (err) {
        console.warn(`EpisodeStorage.readWordTags: invalid JSON in "${path}"`, err);
        return;
      }

      this.addWordTags(data, path);
    }

  addWordTags(data, source = 'inline') {
      if (!Array.isArray(data)) {
        console.warn(`EpisodeStorage.addWordTags: "${source}" must contain an array`);
        return;
      }

      const seenSurface = new Set(Object.keys(this.WordTags.dict));
      const normalizedSurfaces = [];

      data.forEach((item, idx) => {
        if (!item || typeof item !== 'object' || Array.isArray(item)) {
          console.warn(`EpisodeStorage.addWordTags: invalid tag item at index ${idx} in "${source}"`);
          return;
        }

        const { surfaces, embedding } = item;
        if (!Array.isArray(surfaces)) {
          console.warn(`EpisodeStorage.addWordTags: tag[${idx}].surfaces must be an array in "${source}"`);
          return;
        }
        if (!embedding || typeof embedding !== 'object' || Array.isArray(embedding)) {
          console.warn(`EpisodeStorage.addWordTags: tag[${idx}].embedding must be an object in "${source}"`);
          return;
        }

        const normalizedEmbedding = this._normalizeEmbedding(embedding);
        if (!normalizedEmbedding) {
          console.warn(`EpisodeStorage.addWordTags: tag[${idx}].embedding is invalid in "${source}"`);
          return;
        }

        const groupId = this.WordTags.nextGroupId++;
        const groupSurfaces = [];

        surfaces.forEach((surface) => {
          if (typeof surface !== 'string' || !surface.trim().length) {
            console.warn(`EpisodeStorage.addWordTags: invalid surface in tag[${idx}] in "${source}"`);
            return;
          }

          if (seenSurface.has(surface)) {
            console.warn(`EpisodeStorage.addWordTags: duplicate surface "${surface}" ignored in "${source}"`);
            return;
          }

          seenSurface.add(surface);
          normalizedSurfaces.push({ surface, embedding: normalizedEmbedding, groupId });
          groupSurfaces.push(surface);
        });

        if (groupSurfaces.length > 0) {
          this.WordTags.groups[groupId] = {
            surfaces: groupSurfaces,
          };
        }
      });

      normalizedSurfaces.sort((a, b) => {
        const diff = b.surface.length - a.surface.length;
        return diff !== 0 ? diff : a.surface.localeCompare(b.surface);
      });

      const updatedDict = { ...this.WordTags.dict };
      const baseIndex = Object.keys(this.WordTags.dict).length;
      normalizedSurfaces.forEach((item, index) => {
        updatedDict[item.surface] = {
          index: baseIndex + index,
          embedding: item.embedding,
          groupId: item.groupId,
        };
      });

      this.WordTags.dict = updatedDict;
    }

  async readStatic(botName, partName) {
    if (!botName || !partName) {
      return;
    }

    const path = `static/bots/${botName}/${partName}.episode.json`;
    let response;

    try {
      response = await fetch(path);
    } catch (err) {
      console.warn(`EpisodeStorage.readStatic: failed to fetch "${path}"`, err);
      return;
    }

    if (!response.ok) {
      console.warn(`EpisodeStorage.readStatic: failed to load "${path}" (${response.status})`);
      return;
    }

    let data;
    try {
      data = await response.json();
    } catch (err) {
      console.warn(`EpisodeStorage.readStatic: invalid JSON in "${path}"`, err);
      return;
    }

    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      console.warn(`EpisodeStorage.readStatic: "${path}" must contain an object`);
      return;
    }

    this.staticSource = data;
    this.staticSource.timestamp = data.timestamp !== undefined ? data.timestamp : null;
  }

  async build(botName = this.botName, partName = this.partName) {
    if (!botName || !partName) {
      throw new Error("build: botNameとpartNameが指定されていない");
    }

    this.botName = botName;
    this.partName = partName;

    const sources = [
      { name: 'staticSource', source: this.staticSource },
      { name: 'firestoreSource', source: this.firestoreSource },
    ].filter((entry) => entry.source);

    if (sources.length === 0) {
      console.warn('EpisodeStorage.build: no staticSource or firestoreSource loaded');
      return false;
    }

    for (const { name, source } of sources) {
      const result = validateData(source);
      if (result !== 'ok') {
        console.warn(`EpisodeStorage.build: invalid ${name}`, result);
        return false;
      }
    }

    await this._loadStaticTagFiles();

    if (Array.isArray(this.staticSource?.tags)) {
      this.addWordTags(this.staticSource.tags, 'staticSource.tags');
    }

    if (Array.isArray(this.firestoreSource?.tags)) {
      this.addWordTags(this.firestoreSource.tags, 'firestoreSource.tags');
    }

    const sourceTimestamp = this._getSourceTimestamp();
    const cached = await this._loadCache(botName, partName);
    if (cached && this._isCacheFresh(cached.timestamp, sourceTimestamp)) {
      this.cache = cached;
    }

    const dataRows = this._collectDataRows();
    const { blocks, indexMap } = this._buildWordVectorBlocks(dataRows);
    this.wordVector = blocks;
    this.indexMap = indexMap;
    this.dataRows = dataRows;
    this.attentionVectors = this._buildAttentionVectors(this.wordVector);

    if (this.cache && this._isCacheFresh(this.cache.timestamp, sourceTimestamp)) {
      return true;
    }

    const { vocab, matrix } = this._buildCacheMeta(this.wordVector);
    const timestamp = sourceTimestamp > 0 ? sourceTimestamp : Date.now();
    const cacheEntry = { botName, partName, timestamp, vocab, matrix };

    await this._saveCache(cacheEntry);
    this.cache = cacheEntry;
    return true;
  }

  retrieve(message, verbose=false) {
    this.messageHistory = Array.isArray(this.messageHistory) ? this.messageHistory : [];
    this.messageHistory.push(message);

    const text = typeof message === 'string'
      ? message
      : message && typeof message.text === 'string'
        ? message.text
        : '';
    const messageVector = this._embedText(text);
    this.vector = messageVector;
    console.log("retrieve vector",this.vector);

    if (!messageVector || !Object.keys(messageVector).length || !Array.isArray(this.wordVector)) {
      return {
        status: "error",
        message:"入力メッセージがベクトル化できませんでした"
      }
    }

    const flatVectors = [];
    const flatIndexes = [];
    for (let blockIndex = 0; blockIndex < this.wordVector.length; blockIndex += 1) {
      const block = this.wordVector[blockIndex];
      const blockIndexes = Array.isArray(this.indexMap[blockIndex]) ? this.indexMap[blockIndex] : [];
      for (let entryIndex = 0; entryIndex < block.length; entryIndex += 1) {
        flatVectors.push(block[entryIndex]);
        flatIndexes.push(blockIndexes[entryIndex]);
      }
    }

    if (!flatVectors.length) {
      return {
        status: "error",
        message: "flatVectorsが空です"
      }
    }

    const scored = flatVectors
      .map((vector, index) => ({ score: this._vectorDot(messageVector, vector), index }))
      .sort((a, b) => b.score - a.score);

    const precision = this._getPrecisionThreshold();
    const candidates = scored.filter((candidate) => {
      const rowIndex = flatIndexes[candidate.index];
      return candidate.score > precision && this._hasNextDataRow(rowIndex);
    });

    if (!candidates.length) {
      if(verbose){
        let ms = [];
        const viewSize = 5 ? scored.length>5 : scored.length;
        for(let i=0; i<viewSize; i++){
          let v=scored[i];
          ms.push(`${this.partName} ${i}: score: ${v.score}, index: ${v.index}`)
        }
        return {
          status: "low score",
          message: ms.join('<br>')
        }
      }
      return null
    }

    const topCount = Math.min(4, candidates.length);
    const topCandidates = candidates.slice(0, topCount);
    const selected = topCandidates[Math.floor(Math.random() * topCandidates.length)];
    const matchedRowIndex = flatIndexes[selected.index];
    const nextRow = this._getNextDataRow(matchedRowIndex);

    if (!nextRow) {
      if(verbose){
        return {
          status: "no textRow",
          message: `${this.partName} matchedRowIndex=${matchedRowIndex}, topCount=${topCount}`
        }
      }
      return null;
    }

    const textIndex = this._getTextIndex();
    const responseRow = Array.isArray(nextRow) ? [...nextRow] : nextRow;
    const substitutions = this._buildWordTagSubstitutionMap(text);
    this.WordTagsCache = substitutions;

    if (textIndex >= 0 && Array.isArray(responseRow) && typeof responseRow[textIndex] === 'string') {
      responseRow[textIndex] = this._rewriteTextWithMatchedTags(responseRow[textIndex], substitutions);
    }

    return {
      status: "ok",
      row: responseRow,
      score: selected.score,
    };
  }

  _buildWordTagSubstitutionMap(text) {
    const substitutions = {};
    if (!text || typeof text !== 'string' || !this.WordTags.dict) {
      return substitutions;
    }

    const surfaces = Object.keys(this.WordTags.dict)
      .sort((a, b) => {
        const diff = b.length - a.length;
        return diff !== 0 ? diff : a.localeCompare(b);
      });

    const used = Array(text.length).fill(false);

    for (const surface of surfaces) {
      const tag = this.WordTags.dict[surface];
      if (!tag || typeof tag.groupId !== 'number') {
        continue;
      }
      if (substitutions[tag.groupId]) {
        continue;
      }

      let startIndex = 0;
      while (startIndex < text.length) {
        const foundIndex = text.indexOf(surface, startIndex);
        if (foundIndex === -1) {
          break;
        }

        let collision = false;
        for (let i = foundIndex; i < foundIndex + surface.length; i += 1) {
          if (used[i]) {
            collision = true;
            break;
          }
        }

        if (!collision) {
          substitutions[tag.groupId] = surface;
          for (let i = foundIndex; i < foundIndex + surface.length; i += 1) {
            used[i] = true;
          }
          break;
        }

        startIndex = foundIndex + 1;
      }
    }

    return substitutions;
  }

  _rewriteTextWithMatchedTags(text, substitutions) {
    if (!text || typeof text !== 'string' || Object.keys(substitutions).length === 0) {
      return text;
    }

    const replacementMap = {};
    for (const [surface, info] of Object.entries(this.WordTags.dict)) {
      if (!info || typeof info.groupId !== 'number') {
        continue;
      }
      const replacement = substitutions[info.groupId];
      if (replacement) {
        replacementMap[surface] = replacement;
      }
    }

    const surfaces = Object.keys(replacementMap).sort((a, b) => {
      const diff = b.length - a.length;
      return diff !== 0 ? diff : a.localeCompare(b);
    });

    if (!surfaces.length) {
      return text;
    }

    let result = '';
    let index = 0;

    while (index < text.length) {
      let matched = false;
      for (const surface of surfaces) {
        if (text.startsWith(surface, index)) {
          result += replacementMap[surface];
          index += surface.length;
          matched = true;
          break;
        }
      }

      if (!matched) {
        result += text[index];
        index += 1;
      }
    }

    return result;
  }

  _getTextIndex() {
    const columns = Array.isArray(this.staticSource?.columns)
      ? this.staticSource.columns
      : Array.isArray(this.firestoreSource?.columns)
        ? this.firestoreSource.columns
        : [];

    const index = columns.indexOf('text');
    return index !== -1 ? index : 1;
  }

  _getPrecisionThreshold() {
    const staticPrecision = typeof this.staticSource?.factor?.precision === 'number'
      ? this.staticSource.factor.precision
      : null;
    const firestorePrecision = typeof this.firestoreSource?.factor?.precision === 'number'
      ? this.firestoreSource.factor.precision
      : null;

    if (staticPrecision !== null && firestorePrecision !== null) {
      return Math.min(staticPrecision, firestorePrecision);
    }
    if (staticPrecision !== null) {
      return staticPrecision;
    }
    if (firestorePrecision !== null) {
      return firestorePrecision;
    }
    return 0;
  }

  _hasNextDataRow(rowIndex) {
    if (typeof rowIndex !== 'number' || !Array.isArray(this.dataRows)) {
      return false;
    }

    for (let nextIndex = rowIndex + 1; nextIndex < this.dataRows.length; nextIndex += 1) {
      const row = this.dataRows[nextIndex];
      if (row && !row.separator && Array.isArray(row.row)) {
        return true;
      }
    }
    return false;
  }

  _getNextDataRow(rowIndex) {
    if (typeof rowIndex !== 'number' || !Array.isArray(this.dataRows)) {
      return null;
    }

    for (let nextIndex = rowIndex + 1; nextIndex < this.dataRows.length; nextIndex += 1) {
      const row = this.dataRows[nextIndex];
      if (row && !row.separator && Array.isArray(row.row)) {
        return row.row;
      }
    }

    return null;
  }

  async _loadStaticTagFiles() {
    const staticFilesJson = typeof process !== 'undefined' ? process.env?.NEXT_PUBLIC_STATIC_FILES : null;
    if (!staticFilesJson) {
      return;
    }

    let staticFiles;
    try {
      staticFiles = JSON.parse(staticFilesJson);
    } catch (err) {
      console.warn('EpisodeStorage._loadStaticTagFiles: failed to parse NEXT_PUBLIC_STATIC_FILES', err);
      return;
    }

    const tagEntries = Array.isArray(staticFiles)
      ? staticFiles
      : (staticFiles && typeof staticFiles === 'object' && !Array.isArray(staticFiles) ? staticFiles.wordTags : null);

    if (!Array.isArray(tagEntries)) {
      return;
    }

    for (const entry of tagEntries) {
      if (typeof entry !== 'string') {
        continue;
      }

      const normalizedEntry = entry.replace(/\\/g, '/');
      if (/(^|\/)tags\/[^/]+\.json$/.test(normalizedEntry)) {
        await this.readWordTags(normalizedEntry);
      }
    }
  }

  _getSourceTimestamp() {
    const candidates = [this.staticSource?.timestamp, this.firestoreSource?.timestamp];
    const values = candidates.map((value) => {
      if (value instanceof Date) {
        return value.getTime();
      }
      if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
      }
      if (typeof value === 'string' && value.trim().length) {
        const numeric = Number(value);
        if (Number.isFinite(numeric)) {
          return numeric;
        }
        const parsedDate = Date.parse(value);
        if (!Number.isNaN(parsedDate)) {
          return parsedDate;
        }
      }
      return null;
    }).filter((value) => value !== null);

    return values.length ? Math.max(...values) : 0;
  }

  _isCacheFresh(cacheTimestamp, sourceTimestamp) {
    return typeof cacheTimestamp === 'number' && cacheTimestamp > 0 && sourceTimestamp > 0 && cacheTimestamp >= sourceTimestamp;
  }

  async _loadCache(botName, partName) {
    if (!botName || !partName) {
      return null;
    }

    try {
      return await this._db.caches.get([botName, partName]);
    } catch (err) {
      console.warn('EpisodeStorage._loadCache: failed to read cache', err);
      return null;
    }
  }

  async _saveCache(cacheEntry) {
    if (!cacheEntry || typeof cacheEntry !== 'object') {
      return;
    }

    try {
      await this._db.caches.put(cacheEntry);
    } catch (err) {
      console.warn('EpisodeStorage._saveCache: failed to write cache', err);
    }
  }

  _buildCacheMeta(wordVector) {
    const tokenSet = new Set();
    for (const block of Array.isArray(wordVector) ? wordVector : []) {
      if (!Array.isArray(block)) {
        continue;
      }
      for (const item of block) {
        if (!item || typeof item !== 'object' || Array.isArray(item)) {
          continue;
        }
        for (const token of Object.keys(item)) {
          tokenSet.add(token);
        }
      }
    }

    const vocab = Array.from(tokenSet).sort();
    const indexMap = vocab.reduce((map, token, index) => {
      map[token] = index;
      return map;
    }, {});
    const matrix = vocab.map(() => Array(vocab.length).fill(0));

    for (const block of Array.isArray(wordVector) ? wordVector : []) {
      if (!Array.isArray(block)) {
        continue;
      }
      for (const item of block) {
        if (!item || typeof item !== 'object' || Array.isArray(item)) {
          continue;
        }

        const entries = Object.entries(item).filter(([, value]) => typeof value === 'number');
        for (let i = 0; i < entries.length; i += 1) {
          const [tokenA, weightA] = entries[i];
          const indexA = indexMap[tokenA];
          if (indexA === undefined) {
            continue;
          }

          for (let j = 0; j < entries.length; j += 1) {
            const [tokenB, weightB] = entries[j];
            const indexB = indexMap[tokenB];
            if (indexB === undefined) {
              continue;
            }
            matrix[indexA][indexB] += weightA * weightB;
          }
        }
      }
    }

    for (const row of matrix) {
      const sum = row.reduce((acc, value) => acc + value, 0);
      if (sum > 0) {
        for (let i = 0; i < row.length; i += 1) {
          row[i] = row[i] / sum;
        }
      }
    }

    return { vocab, matrix };
  }

  _collectDataRows() {
    const rows = [];
    let index = 0;

    const appendRows = (source) => {
      if (!source || !Array.isArray(source.data)) {
        return;
      }

      const columns = Array.isArray(source.columns) ? source.columns : [];
      const textIndex = columns.indexOf('text') !== -1 ? columns.indexOf('text') : 1;

      for (const row of source.data) {
        if (row === null || typeof row === 'string') {
          rows.push({ separator: true, row, index });
          index += 1;
          continue;
        }
        if (!Array.isArray(row)) {
          index += 1;
          continue;
        }
        const text = row[textIndex];
        rows.push({ separator: false, row, text: typeof text === 'string' ? text : '', index });
        index += 1;
      }
    };

    appendRows(this.staticSource);
    appendRows(this.firestoreSource);

    return rows;
  }

  _buildWordVectorBlocks(dataRows) {
    const blocks = [];
    const indexMap = [];
    let currentBlock = [];
    let currentIndexBlock = [];

    const flushBlock = () => {
      if (currentBlock.length) {
        blocks.push(currentBlock);
        indexMap.push(currentIndexBlock);
      }

      currentBlock = [];
      currentIndexBlock = [];
    };

    for (const item of dataRows) {
      if (item.separator) {
        flushBlock();
        continue;
      }

        if (item.text && item.text.trim().length) {
        const vector = this._embedText(item.text.trim());
        if (Object.keys(vector).length) {
          currentBlock.push(vector);
          currentIndexBlock.push(item.index);
        }
      }
    }

    flushBlock();
    return { blocks, indexMap };
  }

  _embedBlock(lines) {
    const block = [];
    for (const line of lines) {
      const vector = this._embedText(line);
      if (Object.keys(vector).length) {
        block.push(vector);
      }
    }
    return block;
  }

  _buildAttentionVectors(wordVector) {
    if (!Array.isArray(wordVector)) {
      return [];
    }

    return wordVector.map((block) => {
      const contexts = [];
      for (let n = 0; n < block.length; n += 1) {
        const x_n = block[n];
        if (!x_n || typeof x_n !== 'object') {
          contexts.push({});
          continue;
        }

        const scores = [];
        for (let i = 0; i < n; i += 1) {
          const score = this._vectorDot(x_n, block[i]);
          scores.push(score);
        }

        const alphas = this._softmax(scores);
        let context = {};
        for (let i = 0; i < n; i += 1) {
          if (!alphas[i]) {
            continue;
          }
          context = this._addVector(context, block[i], alphas[i]);
        }

        contexts.push(context);
      }
      return contexts;
    });
  }

  _vectorDot(a, b) {
    if (!a || !b || typeof a !== 'object' || typeof b !== 'object') {
      return 0;
    }

    let sum = 0;
    for (const [key, value] of Object.entries(a)) {
      if (typeof value !== 'number') {
        continue;
      }
      const otherValue = b[key];
      if (typeof otherValue === 'number') {
        sum += value * otherValue;
      }
    }
    return sum;
  }

  _addVector(base, vector, scale = 1) {
    if (!vector || typeof vector !== 'object') {
      return base;
    }
    const result = { ...base };
    for (const [key, value] of Object.entries(vector)) {
      if (typeof value !== 'number') {
        continue;
      }
      result[key] = (result[key] || 0) + value * scale;
    }
    return result;
  }

  _softmax(scores) {
    if (!Array.isArray(scores) || scores.length === 0) {
      return [];
    }

    const maxScore = Math.max(...scores);
    const exps = scores.map((score) => Math.exp(score - maxScore));
    const sum = exps.reduce((acc, value) => acc + value, 0);
    if (sum === 0) {
      return exps.map(() => 0);
    }
    return exps.map((value) => value / sum);
  }

  _embedText(text) {
    const tokens = this._segmentText(text);
    const features = {};

    for (let i = tokens.length - 1; i >= 0; i -= 1) {
      const token = tokens[i];
      if (!token) {
        continue;
      }

      if (this._isParticle(token) && i > 0) {
        const prev = tokens[i - 1];
        const combined = `${prev}${token}`;
        const tag = this.WordTags.dict[combined];

        if (tag) {
          this._addEmbeddingToFeatures(features, tag.embedding, 1);
          i -= 1;
          continue;
        }

        this._addTokenWeight(features, prev, 0.5);
        this._addTokenWeight(features, combined, 0.5);
        i -= 1;
        continue;
      }

      const tag = this.WordTags.dict[token];
      if (tag) {
        this._addEmbeddingToFeatures(features, tag.embedding, 1);
      } else {
        this._addTokenWeight(features, token, 1);
      }
    }

    return features;
  }

  _segmentText(text) {
    if (!text || typeof text !== 'string') {
      return [];
    }

    let tokens = [];
    if (this._segmenter && typeof this._segmenter.segment === 'function') {
      tokens = Array.from(this._segmenter.segment(text));
    } else {
      tokens = text.match(/([一-龠ぁ-んァ-ヶー]+|[A-Za-z0-9]+|[^\s])/gu) || [];
    }

    return tokens
      .map((token) => token.trim())
      .filter((token) => token.length > 0 && !this._isPunctuation(token));
  }

  _addEmbeddingToFeatures(features, embedding, weight) {
    if (!embedding || typeof embedding !== 'object' || Array.isArray(embedding)) {
      return;
    }

    for (const [key, value] of Object.entries(embedding)) {
      if (typeof value !== 'number' || Number.isNaN(value)) {
        continue;
      }
      features[key] = (features[key] || 0) + value * weight;
    }
  }

  _addTokenWeight(features, token, weight) {
    if (!token || typeof token !== 'string') {
      return;
    }
    features[token] = (features[token] || 0) + weight;
  }

  _isParticle(token) {
    const particles = new Set([
      'は', 'が', 'を', 'に', 'へ', 'と', 'で', 'や', 'も', 'から', 'まで', 'より', 'だけ', 'しか', 'ほど', 'こそ',
      'ね', 'よ', 'ぞ', 'ぜ', 'さ', 'な', 'か', 'から', 'でも', 'なら', 'けれど', 'しかし', 'ため', 'ので', 'のに',
      'ながら', 'つつ', 'まま', 'だって', 'ても', 'でも', 'たり', 'なり', 'だの', 'やら', 'でも', 'どころか', 'からこそ',
    ]);
    return particles.has(token);
  }

  _isPunctuation(token) {
    return /^[\p{P}\p{S}]+$/u.test(token);
  }

    _normalizeEmbedding(embedding) {
      const entries = Object.entries(embedding).filter(([key, value]) =>
        typeof key === 'string' && key.trim().length > 0 &&
        typeof value === 'number' && !Number.isNaN(value) &&
        value > 0 && value <= 1.0
      );

      const sum = entries.reduce((acc, [, value]) => acc + value, 0);
      if (sum <= 0) {
        return null;
      }

      const normalized = {};
      entries.forEach(([key, value]) => {
        normalized[key] = value / sum;
      });

      return normalized;
    }
}

export function validateTags(data) {
  /*
  [
      {surfaces: [<tag string>,...], embedding: {surface:factor, ...}},
      , ...
  ]
  */
  const errors = [];

  if (!Array.isArray(data)) {
    return ['tags data must be an array'];
  }

  const seenSurface = new Set();

  data.forEach((item, idx) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      errors.push(`tag[${idx}] must be an object`);
      return;
    }

    if (!Array.isArray(item.surfaces)) {
      errors.push(`tag[${idx}].surfaces must be an array`);
    } else {
      if (item.surfaces.length === 0) {
        errors.push(`tag[${idx}].surfaces must not be empty`);
      }

      item.surfaces.forEach((surface, surfaceIdx) => {
        if (typeof surface !== 'string') {
          errors.push(`tag[${idx}].surfaces[${surfaceIdx}] must be a string`);
          return;
        }
        if (!surface.trim().length) {
          errors.push(`tag[${idx}].surfaces[${surfaceIdx}] must not be empty`);
          return;
        }
        if (seenSurface.has(surface)) {
          errors.push(`tag[${idx}].surfaces[${surfaceIdx}] is duplicated across tags: "${surface}"`);
        } else {
          seenSurface.add(surface);
        }
      });
    }

    if (!item.embedding || typeof item.embedding !== 'object' || Array.isArray(item.embedding)) {
      errors.push(`tag[${idx}].embedding must be an object`);
    } else {
      Object.entries(item.embedding).forEach(([key, value]) => {
        if (typeof key !== 'string') {
          errors.push(`tag[${idx}].embedding has invalid key type`);
        }
        if (!key.trim().length) {
          errors.push(`tag[${idx}].embedding contains an empty key`);
        }
        if (typeof value !== 'number' || Number.isNaN(value)) {
          errors.push(`tag[${idx}].embedding["${key}"] must be a number`);
        } else if (!(value > 0 && value <= 1.0)) {
          errors.push(`tag[${idx}].embedding["${key}"] must be > 0 and <= 1.0`);
        }
      });
    }
  });

  return errors.length === 0 ? 'ok' : errors;
}

export function validateData(data) {
  const errors = [];

  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return ['data must be an object'];
  }

  if ('title' in data && typeof data.title !== 'string') {
    errors.push('title must be a string');
  }

  if ('author' in data && typeof data.author !== 'string') {
    errors.push('author must be a string');
  }

  if ('tags' in data) {
    const tagsResult = validateTags(data.tags);
    if (tagsResult !== 'ok') {
      tagsResult.forEach((message) => {
        errors.push(`tags.${message}`);
      });
    }
  }

  if (!data.factor || typeof data.factor !== 'object' || Array.isArray(data.factor)) {
    errors.push('factor must be an object');
  } else {
    const { activity, precision } = data.factor;
    if (typeof activity !== 'number' || Number.isNaN(activity)) {
      errors.push('factor.activity must be a number');
    } else if (!(activity > 0 && activity <= 1.0)) {
      errors.push('factor.activity must be > 0 and <= 1.0');
    }

    if (typeof precision !== 'number' || Number.isNaN(precision)) {
      errors.push('factor.precision must be a number');
    } else if (!(precision > 0 && precision <= 1.0)) {
      errors.push('factor.precision must be > 0 and <= 1.0');
    }
  }

  if (!Array.isArray(data.columns)) {
    errors.push('columns must be an array');
  } else if (data.columns.length === 0) {
    errors.push('columns must not be empty');
  } else {
    data.columns.forEach((column, idx) => {
      if (typeof column !== 'string' || !column.trim().length) {
        errors.push(`columns[${idx}] must be a non-empty string`);
      }
    });
  }

  const validRoles = new Set(['bot', 'user', 'eco']);
  const validFacingStrings = new Set(['face', 'back']);
  const validFacingNumbers = new Set([0, Math.PI]);
  const isValidDate = (value) => {
    if (value === null || value === '') return true;
    if (typeof value !== 'string') return false;
    return /^(0?[1-9]|1[0-2])\/(0?[1-9]|[12][0-9]|3[01])$/.test(value);
  };
  const isValidTime = (value) => {
    if (value === null || value === '') return true;
    if (typeof value !== 'string') return false;
    return /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(value);
  };

  if (!Array.isArray(data.data)) {
    errors.push('data must be an array');
  } else {
    data.data.forEach((row, rowIdx) => {
      if (row === null) {
        return;
      }

      if (typeof row === 'string') {
        if (!row.trim().length) {
          errors.push(`data[${rowIdx}] comment must not be empty`);
        } else if (!row.trimStart().startsWith('#')) {
          errors.push(`data[${rowIdx}] comment must start with "#"`);
        }
        return;
      }

      if (!Array.isArray(row)) {
        errors.push(`data[${rowIdx}] must be null, comment string, or array`);
        return;
      }

      if (!Array.isArray(data.columns) || row.length !== data.columns.length) {
        errors.push(`data[${rowIdx}] length must match columns length (${data.columns ? data.columns.length : 'unknown'})`);
        return;
      }

      // Validate each column based on its name from data.columns
      data.columns.forEach((columnName, colIdx) => {
        const value = row[colIdx];

        if (columnName === 'role') {
          if (typeof value !== 'string' || !validRoles.has(value)) {
            errors.push(`data[${rowIdx}][${colIdx}] role must be one of ${Array.from(validRoles).join(', ')}`);
          }
        } else if (columnName === 'text') {
          if (typeof value !== 'string' || !value.trim().length) {
            errors.push(`data[${rowIdx}][${colIdx}] text must be a non-empty string`);
          }
        } else if (columnName === 'target') {
          if (typeof value !== 'string' || !value.trim().length) {
            errors.push(`data[${rowIdx}][${colIdx}] target must be a non-empty string`);
          }
        } else if (columnName === 'date') {
          if (!isValidDate(value)) {
            errors.push(`data[${rowIdx}][${colIdx}] date must be "%m/%d" or empty/null`);
          }
        } else if (columnName === 'time') {
          if (!isValidTime(value)) {
            errors.push(`data[${rowIdx}][${colIdx}] time must be "%H:%M" or empty/null`);
          }
        } else if (columnName === 'emo') {
          if (typeof value !== 'string') {
            errors.push(`data[${rowIdx}][${colIdx}] emo must be a string`);
          }
        } else if (columnName === 'facing') {
          if (value !== null && value !== '' && typeof value !== 'string' && typeof value !== 'number') {
            errors.push(`data[${rowIdx}][${colIdx}] facing must be a string or number`);
          } else if (typeof value === 'string' && !validFacingStrings.has(value)) {
            errors.push(`data[${rowIdx}][${colIdx}] facing must be one of ${Array.from(validFacingStrings).join(', ')}`);
          } else if (typeof value === 'number' && !validFacingNumbers.has(value)) {
            errors.push(`data[${rowIdx}][${colIdx}] facing must be 0 or Math.PI`);
          }
        } else if (columnName === 'location') {
          if (value !== null && value !== '' && typeof value !== 'string') {
            errors.push(`data[${rowIdx}][${colIdx}] location must be a string`);
          }
        }
      });
    });
  }

  return errors.length === 0 ? 'ok' : errors;
}
