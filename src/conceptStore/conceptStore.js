/*
ConceptStore - indexedDBを記憶媒体とした簡易triple store
===========================================================

## usage

### construct

const cs = new ConceptStore(ownerId);
チャットボットのownerIdを与える。


### insert

cs.insert("{:AURULA} {:called} 'アウルラ'");

複数行入力、'#'で始まる行はコメントとして無視。
cs.insert(`
# アウルラの基本情報
{:AURULA} {:called} 'アウルラ'
{:AURULA} {:isA} {:AIR_FAIRY}
{:AURULA} {:describedAs} '羽のある空気の妖精'
`);

配列を用いた複数行入力
cs.insert([
  '{:CONCEPT001} {:called} "ラーメン"',
  "{:CONCEPT001} {:isA} {:WANTED}",
  "{:CONCEPT001} {:describedAs} {:WANTED}"
]);


### 検索
selectおよびwhereはsparqlの記法のサブセットのように振る舞い、selectでは
出力するべき変数の列挙、whereではtripleを組み合わせた問い合わせを記述する。

cs.select('?s, ?food_name')
  .where('{:AURULA} {:likes} ?s.?s {:isA} {:FOOD}.?s {:called} ?food_name')
  .toArray()

### 削除
await cs.select("*").where('{:NUTS} {:called} "果実"').delete();
select("*")とすることにより検索結果にidが含まれる。このidをキーとして削除が行われる。
delete操作により、_db.activeのレコードが削除され、_db.deletedにレコードが追加される。
この機能はfirestore上のレコードとの同期を最小限のアクセスで実現する。

await cs.vacuum();
_db.deletedのレコードをすべて削除する

## 今後実装予定の機能
### property path
https://qiita.com/frogcat/items/c4b398e50bfc7479cea6

*/
import Dexie from 'dexie';

export class ConceptStore {
  /**
   * ConceptStoreの生成
   * @param {*} ownerId チャットボットのId
   */
  constructor(ownerId) {
    this._db = new Dexie("ConceptStore");
    this._db.version(1).stores({
      active: '++id,ownerId,s,p,o,date',
      deleted: '++id,ownerId,s,p,o,date'
    });
    this.ownerId = ownerId;
    this.store = this._db.active;
  }

  async insert(triples) {
    let jobs = [];
    const date = (new Date()).toLocaleDateString("jp-JP");

    const lines = (typeof triples === 'string' ? triples.split('\n') : triples)
      .map(line => line.trim())
      .filter(line => line.length > 0 && !line.startsWith('#')); // 空行コメント行除去

    for (let triple of lines) {
      const aSpo = spo(triple);
      jobs.push(this.store.add({
        ownerId: this.ownerId,
        s:aSpo.s,
        p:aSpo.p,
        o:aSpo.o,
        date: date
      }));
    }

    return await Promise.all(jobs);
  }

  async delete (triples){
    // 変数を含むものも削除する
    const selector = new ConceptStoreSelect(this, "*");
    return await selector.where(triples).delete();

  }

  select(selector) {
    return new ConceptStoreSelect(this, selector);
  }

  async toArray() {
    return await this.store.where('ownerId').equals(this.ownerId).toArray();
  }

  // select ?x where {:AURULA} {:called} ?x.{:AURULA} {:isA} {:FAIRY}
  //のように一文でのクエリを実行し結果のリストを返す
  async execute(line) {
    const selectRegexp = /^select\s+(\?\w+)\s+where\s+(.+)$/i;
    let match = selectRegexp.exec(line);
    if (match) {
      const selector = new ConceptStoreSelect(this, match[1]);
      return await selector.where(match[2]).toArray();
    }

    const insDelRegexp = /^insert\s+(.+)\s+delete\s+(.+)$/i;
    match = insDelRegexp.exec(line);

    if (match) {
      await this.delete(match[2]);
      return await this.insert(match[1]);
    }

    const delInsRegexp = /^delete\s+(.+)\s+insert\s+(.+)$/i;
    match = delInsRegexp.exec(line);

    if (match) {
      await this.delete(match[1]);
      return await this.insert(match[2]);
    }

    const insRegexp = /^insert\s+(.+)$/i;
    match = insRegexp.exec(line);

    if (match) {
      return await this.insert(match[1]);
    }

    const delRegexp = /^delete\s+(.+)$/i;
    match = delRegexp.exec(line);

    if (match) {
      return await this.delete(match[1]);
    }

  }
}

export class ConceptStoreSelect {
  constructor(cs, selector) {
    this.cs = cs;
    this.selector = selector;
  }

  where(wClause) {
    const wc = (typeof wClause === 'string') ? splitClause(wClause) : wClause;
    const spos = wc.map(x => spo(x));
    return new ConceptStoreWhere(this, spos);
  }
}

export class ConceptStoreWhere {
  constructor(csSelect, wClause) {
    this.cs = csSelect.cs;
    this.selector = csSelect.selector;
    this.wClause = wClause;
    this._filterFn = null;
    this._orderBy = null;
  }

  filter(fn) {
    this._filterFn = fn;
    return this;
  }

  orderBy(varName, asc = true) {
    this._orderBy = { varName, asc };
    return this;
  }

  async resolveInversePathPlus(predicate, goal) {
    const seen = new Set();
    const queue = [goal];
    const results = new Set();

    while (queue.length > 0) {
      const current = queue.shift();
      if (seen.has(current)) continue;
      seen.add(current);

      const records = await this.cs.store
        .where({ ownerId: this.cs.ownerId, p: predicate, o: current })
        .toArray();

      for (const triple of records) {
        results.add(triple.s);
        queue.push(triple.s);
      }
    }

    return Array.from(results).map(subject => ({
      s: subject,
      p: predicate,
      o: goal
    }));
  }

  async resolvePathPlus(start, predicate, goal) {
    const seen = new Set();
    const queue = [start];

    while (queue.length > 0) {
      const current = queue.shift();
      if (seen.has(current)) continue;
      seen.add(current);

      const nextRecords = await this.cs.store
        .where({ ownerId: this.cs.ownerId, s: current, p: predicate })
        .toArray();

      for (const triple of nextRecords) {
        console.log("Following", current, "->", triple.o);
        if (triple.o === goal) return true;
        queue.push(triple.o);
      }
    }

    return false;
  }


  async _exec() {
    const extractedRecords = await Promise.all(this.wClause.map(async (pattern) => {
      if (pattern.pathOp === '+') {
        if (!pattern.s.startsWith('?') && !pattern.o.startsWith('?')) {
          // Case 1: both fixed
          const success = await this.resolvePathPlus(pattern.s, pattern.p, pattern.o);
          if (!success) return [];
          return [{ s: pattern.s, p: pattern.p, o: pattern.o }];
        }

        if (pattern.s.startsWith('?') && !pattern.o.startsWith('?')) {
          // Case 2: ?s {:p}+ :o
          return await this.resolveInversePathPlus(pattern.p, pattern.o);
        }

        console.warn("Unsupported path+ pattern: " + JSON.stringify(pattern));
        return [];
      }

      const dict = { ownerId: this.cs.ownerId };
      if (!pattern.s.startsWith('?')) dict.s = pattern.s;
      if (!pattern.p.startsWith('?')) dict.p = pattern.p;
      if (!pattern.o.startsWith('?')) dict.o = pattern.o;

      const pks = await this.cs.store.where(dict).primaryKeys();
      return await this.cs.store.bulkGet(pks);
    }));


    // {:AURULA} {:isA} {:HUMAN}
    // のように0件検出のパターンがあったら不成立として_exec()は[]を返す
    if (extractedRecords.some(p => p.length === 0)) {
      return [];
    }

    const extractedValues = this.wClause.map((pattern, pIndex) => {
      const extractedRecord = extractedRecords[pIndex];
      return extractedRecord.map((record) => {
        const keyValues = {}
        for (let key of ['s', 'p', 'o']) {
          const varName = pattern[key];
          if (varName.startsWith('?')) {
            keyValues[varName] = record[key];
          }
        }
        return { id: record.id, ...keyValues };
      });
    });

    const mergedValues = extractedValues.reduce((acc, records) => {
      if (acc.length === 0) return records;
      return acc.flatMap(aRecord => {
        return records
          .filter(bRecord => {
            return Object.entries(aRecord).every(([key, value]) => {
              return !key.startsWith('?') || bRecord[key] === value;
            });
          })
          .map(bRecord => ({ ...aRecord, ...bRecord }));
      });
    }, []);

    let finalResult = [];

    if (this.selector === '*') {
      finalResult = mergedValues;
    } else {
      finalResult = mergedValues.map(record => {
        const output = {};
        for (let key of Object.keys(record)) {
          if (this.selector.includes(key)) {
            output[key] = record[key];
          }
        }
        return output;
      });
    }

    if (this._filterFn) {
      finalResult = finalResult.filter(this._filterFn);
    }

    if (this._orderBy) {
      const { varName, asc } = this._orderBy;
      finalResult.sort((a, b) => {
        if (a[varName] < b[varName]) return asc ? -1 : 1;
        if (a[varName] > b[varName]) return asc ? 1 : -1;
        return 0;
      });
    }

    return finalResult;
  }

  async toArray() {
    return await this._exec();
  }

  async delete() {
    const result = await this._exec();
    const date = (new Date()).toLocaleDateString("jp-JP");
    //ここでactiveに存在したレコードをdeletedにコピーするが、idはコピー対象にしない
    await this.cs._db.deleted.bulkAdd(result.map(record => (
      { s: record.s, p: record.p, o: record.o, date: date })))
    await this.cs.store.bulkDelete(result.map(record => record.id));
  }
}

function spo(line) {
  const tokens = [];
  const regex = /"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'|{[^}]+}[+*?]?|\?\w+|\S+/g;
  let match;
  while ((match = regex.exec(line)) !== null) {
    if (match[1] !== undefined) tokens.push(match[1]);      // double-quoted string
    else if (match[2] !== undefined) tokens.push(match[2]); // single-quoted string
    else tokens.push(match[0]);                              // URI or variable or path
  }

  const [s, pRaw, o] = tokens.slice(0, 3);
  let p = pRaw, pathOp = null;

  const pathMatch = pRaw.match(/^({[^}]+})([+*?])$/);
  if (pathMatch) {
    p = pathMatch[1];
    pathOp = pathMatch[2];
  }

  return { s, p, o, pathOp };
}

function splitClause(whereClause) {
  const triples = [];
  let current = '';
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let escape = false;

  for (let i = 0; i < whereClause.length; i++) {
    const char = whereClause[i];

    if (escape) {
      current += char;
      escape = false;
      continue;
    }

    if (char === '\\') {
      current += char;
      escape = true;
      continue;
    }

    if (char === "'" && !inDoubleQuote) {
      inSingleQuote = !inSingleQuote;
    } else if (char === '"' && !inSingleQuote) {
      inDoubleQuote = !inDoubleQuote;
    }

    if (char === '.' && !inSingleQuote && !inDoubleQuote) {
      const trimmed = current.trim();
      if (trimmed.length > 0) {
        triples.push(trimmed);
        current = '';
      }
    } else {
      current += char;
    }
  }

  if (current.trim().length > 0) {
    triples.push(current.trim());
  }

  return triples;
}
