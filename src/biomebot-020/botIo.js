/*
BotIO
================================
チャットボットのデータ入出力


チャットボットはbotId(Aurulaなど)で識別され、そのデータは複数の辞書
ファイルで構成される。データの形式は概念記憶を司る*.concept および
エピソード記憶を保持する *.sequence の二種類で、それぞれ複数存在して
良い。チャットボットのデータはgrapqlをoriginとしfirestore上で最新版が
維持され、それをブラウザにコピーして利用する。
つまり同じbotIdのチャットボットが複数のユーザと並行して会話する。

## データの格納形式
### graphql
graphqlにはチャットボットがユーザとの会話で獲得したのではなく、最初
から知っている知識を格納する。これは会話によって変化せず、管理者による
更新が直ちに反映されることが望ましいためfirestoreを経由せずブラウザ
上に直接コピーされる。graphql上では以下のようなディレクトリ構成で
ファイルを格納する。

static
└ BotModules
    ├ {botId}
    │   ├ *.concept
    │   └ *.sequence
    └ common
         ├ *.concept
         └ *.sequence

概念記憶はgraphql上では*.conceptというファイル形式で格納する。内容は
簡易的な triple である。*.sequenceはチャットボットの会話ログをベースに
した形式である。common下のファイルは全チャットボットに共通のファイル
である。
graphql上の全てのデータは起動時にブラウザ上のindexedDBにdeployする。

### indexedDB
ブラウザ上にはgraphql上のファイルをConceptStore, MemoryStore, 
SequenceStoreに展開して利用する。また会話中に獲得した知識もこれらの
storeに格納され、アプリ起動時にはfirestoreに同期される。
各store上では下記のように区別する。

| 名前   | 内容                                           |
|--------|------------------------------------------------|
| common | graphql由来でチャットボット共通のデータ        |
| origin | graphql由来でチャットボット固有のデータ        |
| gained | 学習により獲得したチャットボット固有のデータ   |

### firestore
firestore上にはチャットボットの知識のうち、学習で獲得した内容のみを
以下のフォルダ構成で格納する。ファイル形式はgraphql互換で、これは
firestore上のファイルをgraphqlに統合しやすくするためである。

collection Bots
  └ doc {botId}
      └ collection Modules
            ├ *.concept
            ├ *.sequence
            └ *.memory

doc {botId}にはModulesに格納した全ファイルのタイムスタンプを保持し、
ローカルへのダウンロードが必要かを判断できるようにする。

*/

import { collection, setDoc } from 'firebase/firestore';
import { ConceptStore } from '../conceptStore/conceptStore';
import { MemoryStore } from '../memoryStore/memoryStore';
import * as sky from '../components/Ecosystem/sky';

export class BotIO {
  constructor() {
    this.cs = new ConceptStore();
    this.ms = new MemoryStore();
    this.surfaceDict = {};

  }

  /**
   * すべてのチャットボットについてgraphqlの最新データをアップロード
   * @param {*} snap graphqlのsnapshot
   * @returns Promise
   */
  async syncOrigin(snap) {
    // 全チャットボットについて
    // snapとconceptStoreのorigin, snapとmemoryStoreのoriginをそれぞれ比較し、
    // snapのほうが新しい場合各storeにアップロード
    const jobs = [];
    for (let node of snap.data.allPlainText.nodes) {

      const p = node.parent;
      const botId = p.relativeDirectory;
      if (p.ext === ".concept") {
        const storeId = botId === "" ? "" : `${botId}:origin`
        const gqd = new Date(p.modifiedTime);
        const csd = await this.cs.updatedAt(storeId);
        if (!csd || gqd > csd) {
          jobs.push(this.uploadStore(storeId, node.content));
        }
      }
    }
    return await Promise.all(jobs);
  }

  async uploadStore(storeId, script) {
    const lines = script.split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0 && !line.startsWith('#')); // 空行コメント行除去;

    const csScript = [];
    const msScript = [];
    for (let line of lines) {
      if (line.startsWith("#") || line.trim() === "") continue;

      if (line.startsWith('{:')) {
        csScript.push(line);
      } else if (line.startsWith('{')) {
        msScript.push(line);
      }
    }

    return await Promise.all([this.cs.insert(csScript, storeId), this.ms.insert(msScript, storeId)]);
  }


  async syncGained(fs) {
    // fsとcs,msの間で新しいデータに同期
    const q = query(collection(fs, 'chatbots'));
    const snap = await getDocs(q);

    snap.forEach(async doc => {
      const botId = doc.id;
      const data = doc.data();
      const fsd = data.updatedAt;
      this.cs.setStoreId(`${botId}:gained`);
      const csd = await this.cs.modifiedTime();
      const newMainRef = collection(fs, "chatbots", botId, "main");
      if (csd && csd < fsd) {
        const payload = await this.cs.dumps();
        await setDoc(newMainRef, payload);
      } else {
        const payload = await getDoc(newMainRef);
        await this.cs.import(payload.data());
      }
    })
  }

  async multiStoreExecute(sentence, storeIds) {
    /* ConceptStore上のすべてのstoreId、またはstoreIdsで指定したstoreについて
    sentenceを実行し、storeIdとあわせて結果を報告

    ・全storeIdを混ぜて検索してしまうと、該当するレコードが重複して生じる
    可能性が大で、さらにそのleft joinされた大量の結果が返ってきてしまう。
    また各storeで優先順位をつけたいが、それが不可能になってしまう。

    ・selectに対しては複数のstoreを混ぜて実行できるが、insertでは
    一つのstoreに限定が必要。各storeに対して実行であればOK
    */

    storeIds = storeIds || await this.cs.getAllStoreIds();
    const results = [];
    for (const storeId of storeIds) {
      this.cs.setStoreId(storeId);
      const r = await this.cs.execute(sentence);

      results.push(...r.map(x => ({ storeId: storeId, ...x })));
    }
    return results
  }


  async execute(sentence, botId) {
    /* ３つのstore <botId>:gained, <botId>:origin, "" に対して
    multiStoreExecuteを実行する。
    */

    return await this.multiStoreExecute(sentence, [`${botId}:gained`, `${botId}:origin`, ""]);
  }

  async executeX(sentence, botId) {
    /* /* ３つのstore <botId>:gained, <botId>:origin, "" に対して
    multiStoreExecuteを実行する。得られた結果のうちすべての?xを集めて
    そのうちランダムに選んだ一つを返す。
    この値がthis.msに含まれる場合展開して返す。
    */
    const results = await this.execute(sentence, botId);
    const values = [];
    for (let result of results) {
      if ('?x' in result) {
        values.push(result['?x']);
      }
    }
    if (results.length === 0) {
      return "";
    }

    const value = values[Math.floor(Math.random() * results.length)];
    const regexp = /^\{[^:}][^\}]+\}/;
    if (regexp.exec(value)) {
      return await this.retrieve(value, botId);
    }
    return value;
  }

  async retrieve(key, botId) {
    // this.ms.retrieveを検索する。
    // まず storeIdを<botId>:gained にしてretrieve()し、結果がなかったら 
    // <botId>:origin 更に結果がなかったら "" というフォールバックを行う。
    // 
    // 検索結果に{}が含まれていたら再帰的にretrieveを行い、
    // 検索結果が conceptStoreのselect文であればthis.executeX を実行する

    const record = (async (key, botId) => {
      this.ms.setStoreId(`${botId}:gained`);
      let record = this.ms.retrieve(key);
      if (record) return record;

      this.ms.setStoreId(`${botId}:origin`);
      record = this.ms.retrieve(key);
      if (record) return record;

      this.ms.setStoreId("");
      record = this.ms.retrieve(key);
      return record;
    })(key, botId);

    const regexp = /^select/i;
    if (regexp.match(record.startsWith("select"))) {
      return await this.executeX(record, botId);
    }
    return record;
  }

  async put(botId, key, value) {
    // botId:gainedにkey,valueのペアを追加する
    return await this.ms.put(`${botId}:gained`, key, value);
  }

  /**
   * チャットボットがecoStateで現れるかどうか判定
   * @param {string} storeId
   * @param {object} ecoState
   * @returns {Promise<boolean>}
   */
  async checkEncounter(storeId, ecoState) {
    // チャットボットがecoStateで現れるかどうか判定
    // backgroundは
    // `linear-gradient(to bottom, rgb(11 22 00), rgb(44 23 5), rgb(44 78 85))`
    // という文字列。このうち２つ目のrgb値を代表とする。
    const { barometer, background } = ecoState;
    this.cs.setStoreId(storeId);
    let _botId = storeId.split(':')[0];
    const botConcept = `{:${_botId.toUpperCase()}}`;

    // 各種出現率を取得
    const erDay = parseRate(await this.executeX(`select ?x where ${botConcept} {:encounterRateDay} ?x`, _botId));
    const erNight = parseRate(await this.executeX(`select ?x where ${botConcept} {:encounterRateNight} ?x`, _botId));
    const erGoodWeather = parseRate(await this.executeX(`select ?x where ${botConcept} {:encounterRateGoodWeather} ?x`, _botId));
    const erBadWeather = parseRate(await this.executeX(`select ?x where ${botConcept} {:encounterRateBadWeather} ?x`, _botId));

    // 背景色から明度(0=夜, 1=昼)を計算
    function getBrightnessFromGradient(bg) {
      // bg: 'linear-gradient(to bottom, rgb(11 22 00), rgb(44 23 5), rgb(44 78 85))'
      if (!bg) return 1;
      const rgbMatches = bg.match(/rgb\((\d+)\s+(\d+)\s+(\d+)\)/g);
      if (!rgbMatches || rgbMatches.length < 2) return 1;
      // 2つ目のrgb値を使う
      const rgbStr = rgbMatches[1];
      const nums = rgbStr.match(/\d+/g);
      if (!nums || nums.length !== 3) return 1;
      const [r, g, b] = nums.map(Number);
      // 標準的な明度計算
      return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    }
    const brightness = getBrightnessFromGradient(background);

    // 昼夜・天候で補間
    const encounterRateDayNight = erNight + (erDay - erNight) * brightness;
    const encounterRateWeather = erBadWeather + (erGoodWeather - erBadWeather) * barometer;
    console.log(erNight, erDay, erBadWeather, erGoodWeather)
    console.log(encounterRateDayNight, encounterRateWeather)
    // ロール判定

    return (Math.random() < (encounterRateDayNight + encounterRateWeather));
  }

  storeIdToBotId(storeId) {
    const names = storeId.split(':')
    return names[0]
  }

  async buildSurfaceDict(botId) {
    /*
    this.csの select ?surface where ?concept {:called} ?surface、
    this.msに含まれる全てのkey:valueについて、?surfaceやvalueをタグに変換する
    辞書を生成し、this.surfaceDictに保持する。
    Aurula:gained, Aurula:origin, "" のようにstoreIdをまたいで処理し、
    同じsufaceについて優先順位はgained > origin > ""とする。

    */
    const that = this;
    async function getConcSurf(storeId) {
      that.cs.setStoreId(storeId);
      const records = await that.cs.select("?conc, ?surf")
        .where("?conc {:called} ?surf")
        .toArray();
      records.forEach(record => {
        that.surfaceDict[record["?surf"]] = record["?conc"];
      });
    }

    async function getMemSurf(storeId){
      const records = await that.ms.store
        .where({storeId:storeId})
        .toArray();

      console.log("storeID",storeId, "memSurf",records)
      records.forEach(record=>{
        that.surfaceDict[record.value]=record.key;
      })
    };


    const jobs = [
      getMemSurf(""),
      getMemSurf(`${botId}:origin`),
      getMemSurf(`${botId}:gained`),
      getConcSurf(""),
      getConcSurf(`${botId}:origin`),
      getConcSurf(`${botId}:gained`)
    ];
    return await Promise.all(jobs);

  }
}

function parseRate(str) {
  if (!str) return 0;
  str = str.toString().trim();
  if (str.endsWith('%')) {
    return parseFloat(str) / 100;
  }
  return parseFloat(str) || 0;
}

export const botIo = new BotIO;
