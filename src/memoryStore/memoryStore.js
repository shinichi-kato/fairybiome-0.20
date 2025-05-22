/*
WorkingMemoryStore - indexedDBを記憶媒体とした遅延揮発型辞書
===============================================================

## usage

### construct

const ws = new WorkingMemoryStore(storeId);
チャットボットのIdをstoreIdとして与えることでチャットボット固有のデータにアクセスする。
storeIdを指定しない場合、selectはあらゆるチャットボットの固有の知識に加え
storeId無指定の状態でinsertされたアクセスする。

### insert

ws.insert("{DESU} です。,です！");
配列により複数行入力も可能。一つの文字列に複数のパターンを記述する際は改行で区切る。
'#'で始まる行はコメントとして無視される。
最初の空白文字までをキーとし、以降はカンマ区切りされた一つまたは複数の値とみなす。
各値はダブルクォーテーションまたはシングルクォーテーションで囲うこともできる。


cs.insert(`
# アウルラの基本情報
{BACKGROUND_COLOR} #de53a1
{AVATAR_DIR} wing-fairy-girl
`);

### 検索

*/
import Dexie from 'dexie';

export class MemoryStore {
  constructor(storeId = null) {
    this._db = new Dexie("WorkingMemoryStore");
    this._db.version(1).stores({
      workMem: '++id,[storeId+key]',
      metaData: '[storeId+key]'
    });
    this.storeId = storeId;
    this.store = this._db.workMem;
  }

  setStoreId(storeId) {
    this.storeId = storeId;
  }

  async updatedAt(storeId = null) {
    storeId = storeId !== null ? storeId : this.storeId;
    console.assert(storeId, "MemoryStore.updatedAt(): storeIdが指定されていません");

    const f = await this._db.metaData
      .where('[storeId+key]')
      .equals([storeId || this.storeId, 'updatedAt'])
      .first();
    console.log("read updated At", storeId || this.storeId, f)
    return f?.value;

  }

  async insert(items, storeId = null) {
    storeId = storeId !== null ? storeId : this.storeId;
    console.assert(storeId, "ConceptStore.insert(): storeIdが指定されていません");
    let jobs = [];

    const lines = (typeof items === 'string' ? items.split('\n') : items)
      .map(line => line.trim())
      .filter(line => line.length > 0 && !line.startsWith('#')); // 空行コメント行除去
    jobs = lines.map(line => {
      const kv = keyValue(line);
      this.store.add({
        storeId: storeId,
        ...kv,
      })
    });

    jobs.push(this._db.metaData.put({
      storeId: storeId,
      key: 'updatedAt',
      value: new Date()
    }));

    return await Promise.all(jobs);
  }

  async toArray() {
    return await this.store
      .where('[storeId+key]')
      .between([this.storeId, Dexie.minKey], [this.storeId, Dexie.maxKey])
      .toArray();
  }

  async dumps() {
    const data = await this.toArray();
    return data.map(node => (`${node.key} ${node.values.join(',')}`))

  }

  async retrieve(key) {
    const extractedRecords = await this.store.where("[storeId+key]").equals([this.storeId, key]).toArray();
    return getRandomElement(extractedRecords);
  }
}

function keyValue(line) {
  /*
  Parses a line like '{KEY} value1,value2,value3,...'
  Returns { key: '{KEY}', values: [value1, value2, ...] }
  */
  const regex = /({[^:][^}]+})\s+(.+)/;
  const regexItems = /"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'|([^,]+)/g;
  const match = regex.exec(line);
  if (!match) return { key: null, values: [] };

  const key = match[1];
  const valueStr = match[2];
  const values = [];
  let itemMatch;
  while ((itemMatch = regexItems.exec(valueStr)) !== null) {
    if (itemMatch[1] !== undefined) values.push(itemMatch[1]);
    else if (itemMatch[2] !== undefined) values.push(itemMatch[2]);
    else if (itemMatch[3] !== undefined) values.push(itemMatch[3].trim());
  }
  return { key, values };
}

function getRandomElement(records) {
  if(records.length === 0) {
    return undefined;
  }
  let randomIndex = Math.floor(Math.random() * records.length);
  const values = records[randomIndex].values;

  if (values.length === 0) {
    return undefined; // Return undefined for empty arrays
  }
  randomIndex = Math.floor(Math.random() * values.length);
  return values[randomIndex];
}