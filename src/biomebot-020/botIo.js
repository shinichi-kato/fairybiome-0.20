/*
BotIO
================================
チャットボットのデータ入出力

チャットボットはbotId(Aurulaなど)で識別され、
ConceptStore (概念辞書)
MemoryStore (変数記憶)
SequenceStore (エピソード記憶)
の３種類の記憶方式を利用する。またそれぞれについて
common (graphqlのコピーでチャットボット共通の知識)
origin (graphqlのコピー)
gained (学習により獲得した知識)
という三層のデータを利用する。

またチャットボットはIdごとに一つしか存在せず、同じIdの
チャットボットが複数のユーザと並行して会話する。

*/

import { collection, setDoc } from 'firebase/firestore';
import { ConceptStore } from '../conceptStore/conceptStore';
import { MemoryStore } from '../memoryStore/memoryStore';
import * as sky from '../components/Ecosystem/sky';

export class BotIO {
  constructor() {
    this.cs = new ConceptStore();
    this.ms = new MemoryStore();
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
    // ConceptStore上のすべてのstoreIdについてsentenceで検索した結果を
    // 報告

    storeIds = storeIds || await this.cs.getAllStoreIds();
    const results = [];
    for (const storeId of storeIds) {
      this.cs.setStoreId(storeId);
      const r = await this.cs.execute(sentence);

      results.push(...r.map(x => ({ storeId: storeId, ...x })));
    }
    return results
  }


  async execute(sentence, botId){
    // <botId>:gained、　(獲得した知識)
    // <botId>:origin、　(graphqlから供給した知識)
    // "" (共通の知識)という３つのstoreを検索対象にして
    // multiStoreExecuteを実行する。
    
    return await this.multiStoreExecute(sentence, [`${botId}:gained`,`${botId}:origin`,""]);
  }

  async retrieve(sentence, botId){
    // this.ms.retrieveを検索する。
    // まず <botId>:active でretrieve()し、結果がなかったら <botId>:origin
    // 更に結果がなかったら "" というフォールバックを行う。
    // 
    // 検索結果に{}が含まれていたら再帰的にretrieveを行い、
    // 検索結果が{:から始まっていたらtripleとみなしてthis.execute を実行する
    // を実行する。

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
    this.ms.setStoreId(storeId);

    // 各種出現率を取得
    const erDay = parseRate(await this.ms.retrieve('{ENCOUNTER_RATE_DAY}'));
    const erNight = parseRate(await this.ms.retrieve('{ENCOUNTER_RATE_NIGHT}'));
    const erGoodWeather = parseRate(await this.ms.retrieve('{ENCOUNTER_RATE_GOODWEATHER}'));
    const erBadWeather = parseRate(await this.ms.retrieve('{ENCOUNTER_RATE_BADWEATHER}'));

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
    console.log(erNight,erDay,erBadWeather,erGoodWeather)
    console.log(encounterRateDayNight,encounterRateWeather)
    // ロール判定

    return (Math.random() < (encounterRateDayNight+encounterRateWeather));
  }

  storeIdToBotId(storeId){
    const names = storeId.split(':')
    return names[0]
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
