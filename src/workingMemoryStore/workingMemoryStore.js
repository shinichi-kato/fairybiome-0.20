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

export class WorkingMemoryStore {
  constructor(storeId,) {
    this._db = new Dexie("WorkingMemoryStore");
    this._db.version(1).stores({
      active: '++id,storeId,key,date',
    });
    this.storeId = storeId;
    this.store = this._db.workMem;
  }

  async setstoreId(storeId) {
    this.storeId = storeId;
    this.store = this._db.active;
  }

  async insert(items) {
    let jobs = [];
    const date = (new Date()).toLocaleDateString("jp-JP");

    const lines = (typeof items === 'string' ? items.split('\n') : items)
      .map(line => line.trim())
      .filter(line => line.length > 0 && !line.startsWith('#')); // 空行コメント行除去

    jobs = lines.map(line => {
      const kv = keyValue(line);
      this.store.add({
        storeId: this.storeId,
        ...kv,
        date: date
      })
    });

    return await Promise.all(jobs);
  }

  async retrieve(key){
    const extractedRecords = await this.store.where({key:key}).toArray
  }
}

function keyValue(line) {
  const regex = /({[^:][^}]+})\s(.+)/;
  const regexItems = /"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'|[^,]+/g;
  let match = regex.exec(line);
  if (match) {
    let matchItems;
    let values;
    while ((match = regexItems.exec(match[2])) !== null) {
      if (match[1] !== undefined) values.push(match[1]);
      else if (match[2] !== undefined) values.push(match[2]);
      else values.push(match[0]);
    }
  }
  return { key: match[1], values: values }

} 