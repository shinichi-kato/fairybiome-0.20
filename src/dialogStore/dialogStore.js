/*
DialogStore - indexedDBを記憶媒体としたログ型辞書
===============================================
## usage
### construct

const ls = new DialogStore(storeId);
チャットボットのIdをstoreIdとして与えることでチャットボット固有のデータにアクセスする。
storeIdを指定しない場合、selectはあらゆるチャットボットの固有の知識に加え
storeId無指定の状態でinsertされたアクセスする。

graphqlのデータはtransformer-dialogでpreprocessされ、
{
  tag: {key:value, ...},
  messages: [{head, text, date, time},...]
}
という形式で与えられる。

### insert
const ds = new DialogStore(storeId);
ds.insert(messages)

### retrieve

## ログ型辞書とその利用
ログ型辞書は2名以上で行われた談話の内容を時系列に記憶し、ユーザの入力と似た行が
あればその次の行を出力とするという形式である。
ここで自然なログではbotとuserが必ずしも交代で発話するとは限らない。そのためログ
上ではユーザの発言だったものをbotがあたかも自分の発言かのように言う場合も発生しうる。
また自分の発言を聞いてもう一度自分が発話するという場合もあってよい。

DialogStoreのretrieve関数では文字列をタグ化、分かち書きしたものをwordVector化し、
シンプルなcos類似度行列を使ったretrieveを行うが、上述の挙動を再現するため
headも含めて特徴量化する。

| 要素 | feature                            |
|------|------------------------------------|
| head | 発信者情報（後述）                 |
| text | ノード化＋分かち書き→wordVector化 |
| date | 一年を2radとしたラジアン値化       |
| time | 一日を2radとしたラジアン値化       |

このときheadは下記のような種類がある。
user0の数字はfirestoreから取得するシステム共通のuser id値で、タグは
conceptStoreと共通にする。headにより一つまたは複数の話者特徴量が1になる。

| headの例         | sender特徴量        | 説明                     |
|------------------|---------------------|--------------------------|
| bot              | bot peace           | チャットボット           |
| (cheer)          | bot cheer           | チャットボットの表情     |
| cheer            | bot cheer           | チャットボットの表情     |
| user             | user peace          | 任意のユーザ             |
| {:user0}(laugh)  | user {:user0} laugh | ユーザの表情             |
| {:Aurula}(cheer) | bot {:Aurula} cheer | 他のチャットボットの表情 |     
| cue              | cue                 | 入退室・環境メッセージ他 |

チャットボットの辞書としてはcueは必ずブロックの先頭として扱い、出力には
しない。
また「user1の発言にuser2が答えた」という記憶から、user1の発言に
近い入力が見つかった場合user2の返答をチャットボットが利用する場合がある。
このように自身以外の話者による発言には文末に引用を示す{REPORTEDLY}を付加する。

*/

import Dexie from 'dexie';

export class DialogStore {

  constructor(storeId) {
    this._db = new Dexie("LogMemoeyStore");
    this._db.version(1).stores({
      dialog: '++id,storeId',
      metaData: ['storeId+key']
    });
    this.setStoreId(storeId);
    this.store = this._db.dialog;
    this.matrix = null;
  }

  setStoreId(storeId) {
    this.storeId = storeId;
  }

  /**
   * dialogデータの上書き(過去のデータがあれば削除)
   * @param {*} dialog 
   * @param {*} storeId 
   * @returns 
   */
  async write(dialog, storeId = null) {
    storeId = storeId !== null ? storeId : this.storeId;
    console.assert(storeId, "DialogStore.insert(): storeIdが指定されていません");
    const jobs = [this.store.where('storeId').equals(storeId).delete()];
    const date = new Date();
    for (let d of dialog) {
      jobs.push(this.store.add({
        storeId: storeId,
        head: d.head,
        test: d.text,
        date: d.date,
        time: d.time,
      }));
    }

    jobs.push(this._db.metaData.put({
      storeId: storeId,
      key: 'dialogLoadedAt',
      value: new Date()
    }));

    return await Promise.all(jobs);
  }

  async deploy(storeId) {
    // dialogの内容がmatrixより新しい場合matrixを計算
    async function checkMatrixOutdated() {
      const matrixGeneratedAt = await this._db.metaData.where(
        { storeId: storeId, key: 'matrixGeneratedAt' }).toArray();
      if (matrixGeneratedAt.length === 0) {
        return true;
      }
      const dialogLoadedAt = await this._db.metaData.where({
        storeId: storeId, key: "dialogLoadedAt"
      }).toAttay();
      if (matrixGeneratedAt[0] < dialogLoadedAt[0]) {
        return false;
      }
      return true;
    }

    if (await checkMatrixOutdated()) {
      let script = await this.store.where('storeId').equals(storeId).toArray();
      script= await preprocess(script)
      this.matrix = await matrixize(script)
    }
    

  }
  async retrieve(storeId,input){
    if(!this.matrix){
      await this.deploy(storeId);
    }

  }



}

async function tee(source){
  /*sourceをinScriptとoutScriptに変換
  */
}

async function preprocess(source) {
  /*
  storeIdで指定されたdialogの内容は
  [{head,text,date,time},...]
  であり、これに対して以下の処理を行う。
  
  ・一つの話題をブロックと呼び、ブロックは空行で区切られる。
  ・cueは必ずブロック先頭にする
  ・headをspeaker,avatar,idに分解する
  preprocessはstoreIdで指定されたdialogテーブルの内容を
  [
    [{speaker,avatar,id,text,date,time},...],...
  ]
    というデータに変換して返す。
  */

  function parseHead(head) {
    let speaker = "";
    let avatar = "";
    let id = "";

    if (head in { bot: true, cue: true, user: true }) {
      return { speaker: head, avatar, id }
    }

    const avatarMatch = head.match(/^\([^)]+\)$/);
    if (avatarMatch) {
      return { speaker: bot, avatar: avatarMatch[1], id };
    }

    const userIdMatch = head.match(/^(\{:user.+\})(\([^\)]+\))?$/);
    if (idMatch) {
      return { speaker: "user", avatar: userIdMatch[2] || "", id: userIdMatch[1] }
    }

    const botIdMatch = head.match(/(\{:.+\})(\([^\)]+\))?$/);
    if (botIdMatch) {
      return { speaker: "bot", avatar: botIdMatch[2] || "", id: botIdMatch[1] }
    }

    return { speaker: "bot", avatar: head, id }
  }


  const blocks = [];
  let block = [];
  for (let line of source) {
    if (line.head === null) {
      blocks.push(block);
      block = [];
      continue;
    }
    if (line.head === "cue") {
      blocks.push(block);
      block = [line];
      continue;
    }
    block.push({
      ...parseHead(line.head),
      text: line.text,
      date: line.date,
      time: line.time
    }
    )
  }

  if (block.length !== 0) {
    blocks.push(block);
  }


  return blocks;
}