/*
BiomebotProvider
===========================
複数のパートが競争的に動作することで一つのキャラクタを形成するチャットボット

## パートの管理と制御
一つのチャットボットは複数のパートからなり、conceptとepisodeという二種類の
workerで構成される。conceptはセマンティックtripleの簡易版をバックボーンとした
DBで、episodeは類似度行列型の簡易な機械学習モデルである。

| name   | part             | status  | 
|--------|------------------|---------|
| Aurula | main.concept     | active  |
| Aurula | aurula.concept   | active  |
| Aurula | greeting.episode | idle    |

main.conceptはチャットボットの不在・在室管理および基本パラメータの定義をしており、
すべてのチャットボットのmain.conceptはbotProvider起動時に必ず起動される。そこから
ユーザの呼びかけなどでチャットボットが起動することになった場合同じチャットボットの
全パートが起動される。
この起動状況は管理画面で確認することができ、statusは以下のようになる。
active: 活性化されていて返答しやすい
idle: 活性化していない
dead: 機動しているはずだが応答がない
starting: 起動コマンドを受け付けた
なし: 起動していない

### パートへのコマンド送信
管理画面からパートに対して以下のコマンドを送ることができる
| command    | 効果                    |
|------------|-------------------------|
| start      | workerを生成            |
| terminate  | workerを破壊            |
| activate   | 活性化し次の返答を行う  |
| deactivate | idle化                  |
| status     | 現在の状態をレポート    |

### パートからのメッセージ受信


## botのデータ格納状況とデータ表現
botのタイプにはconceptとepisodeの二つがある。

### conceptタイプ
概念記憶を司るパートでConceptStoreにtripleで表現された概念知識を格納する。
conceptStoreの内容はgraphqlから共有されたoriginと、会話で獲得したgainedに大別される。




## biomebotProvider起動時のシークエンス
1. graphql上の全bot,firestore上の全botについて下記情報をdexieJsのbiomebot DBに登録。
biomebot : {
  [botName+partName],
  lastStartedAt,
}
partNameがmainである全てのデータについてgqまたはfsからconceptStoreへのアップデートを行う

2. 全てのmainをconstructしてmodulesRefに登録し起動コマンドを送る。
moduleRef.current[`${botName}.${partName}`]=worker()

3. lastStartedAtが本日中の場合{:resumeTalkRate}ロールに成功したらこのbotNameに属する
全てのpartについてデータのアップデートとstartを行う。


4. 3に失敗したら全妖精の出現確率ロールで出現判定かつ最も高いスコアを出した
中からランダムに選んだ一体がactivateされる。すべての妖精が出現ロールに失敗したら最も高いスコアを
出した中からランダムに選んだ一体がstartされる。


## データのsync
チャットボットのデータはConceptStoreとMemoryStoreの２つに格納され、それぞれ
origin: graphqlにあるデータ
gained: あとから獲得したデータ
に分かれる。originのデータはgraphqlから供給され、firestore上には格納しない。
また同じ内容のデータがあった場合はoriginよりもgainedが優先される。
originのデータはgraphqlから供給されconceptStoreとMemoryStoreに格納される。
gainedのデータはgraphqlにはなくconceptStore,MemoryStoreの内容がfirestoreに
同期される。

graphql上のデータは以下の形式で格納される。
botModules
├ Aurula
│    ├ main.concept
│    ├ greeting.sequence
︙    ︙
│    └ story.e
└ common
    ├ common_knowledge.concept
    └ episode.

firestore上では

chatbots collection
└ Aurula document
  ├ catalogueデータ
    └ modules collection
        ├ main.concept document
        │   ├ lastDeployedAt: 最後に起動されたtimestamp
        │   ├ conceptStore 会話によって獲得したConceptStoreデータ
        │   └ memoryStore 会話によって獲得したMemoryStoreデータ
        ︙
        ├ greeting.episode document
        │   ├ sequenceStore 会話によって獲得したSequenceStoreデータ
        │   └ memoryStore 会話によって獲得したMemoryStoreデータ
        ︙
        └ story.episode

とする。firestore上にはoriginである{:COMMON}も置かない。

■ graphql - conceptStore, memoryStore, sequenceStore間の同期(origin)
conceptStore上ではinsertを行うとupdatedAtが変更される。この値とgraphqlのmodifiedTimeを
比較し、graphql側が新しい場合conceptStore, memoryStoreにアップロードする。

■ firestore - conceptStore, memoryStore間の同期(gained)
conceptStoreのupdatedAtとfirestoreのupdatedAtを比較し、conceptStoreのほうが
新しい場合はconceptStoreのデータをfirestoreに書き込む。逆の場合はfirestoreのデータを
conceptStoreに書き込む
*/

import React, {
  useReducer, createContext,
  useContext,
} from 'react'
import { useStaticQuery, graphql } from 'gatsby';
import { botIo } from './botIo';

import { ConceptStore } from '../conceptStore/conceptStore';
import { MemoryStore } from '../memoryStore/memoryStore';

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    let j = Math.floor(Math.random() * (i + 1)); // 0 から i のランダムなインデックス
    [array[i], array[j]] = [array[j], array[i]]; // 要素を入れ替えます
  }
}

const biomebotQuery = graphql`
query MyQuery {
  allFile(filter: {sourceInstanceName: {in: "userAvatar"}}) {
    nodes {
      sourceInstanceName
      relativePath
    }
  }
}
`;

export const BiomebotContext = createContext();

const initialState = {
  botId: null,
  storeUpdatedAt: null, // updateを行った日付
}

function reducer(state, action) {
  // console.log(action.type, action);
  switch (action.type) {
    case 'setChannel': {
      return {
        ...state,
        channel: action.channel,
      };
    }

    case 'storeUpdated': {
      return {
        ...state,
        storeUpdatedAt: action.date
      }
    }
  }
}

export default function BiomebotProvider({ firebase, firestore, summon, initialPart, children }) {
  const auth = useContext(AuthContext);
  const eco = useContext(EcosystemContext);
  const [state, dispatch] = useReducer(reducer, initialState);
  const snap = useStaticQuery(biomebotQuery);
  const modules = useRef({});

  // ---------------------------------------------------
  // broadcast channelの初期化
  //

  useEffect(() => {
    let ch;
    if (!state.channel) {
      ch = new BroadcastChannel('biomebot');
      dispatch({ type: 'setChannel', channel: ch });
    }
    return () => {
      if (ch) {
        ch.close();
      }
    };
  }, [state.channel]);

  // ---------------------------------------------------
  // 起動シークエンス
  // 

  useEffect(() => {
    if (auth.uid && !state.botId && firestore) {
      const today = (new Date()).toLocaleDateString("jp-JP");
      const userConcept = `{:${auth.conceptName}}`;

      (async () => {
        // 0. ファイルを同期
        if (state.storeUpdatedAt !== today) {
          await botIo.syncOrigin(snap);
          dispatch({ type: 'storeUpdated', date: today });
        }

        const botId = await (async () => {
          // 1. 今日ユーザと会話したチャットボットを抽出
          //    そのチャットボットのresumeチェック
          let currentBots = await botIo.multiStoreExecute(
            `select ?x where ${userConcept} {:files} ?x.?x {:localeDate} "${today}"`
          );

          shuffle(currentBots);
          for (const currentBot of currentBots) {
            const _botId = currentBot.storeId.split(':')[0];
            const botConcept= `{:${_botId.toUpperCase()}}`;
            const resumeRate = await botIo.ms.executeX(`${botConcept} {:resumeTalkRate} ?x`,_botId);
            if (Math.random() < resumeRate) return currentBot.storeId;
          }

          // 2. ランダムに選んだチャットボットの出現チェック
          while (true) {
            for (const currentBot of currentBots) {
              if (await botIo.checkEncounter(currentBot.storeId, eco.ecoState)) {
                
                return botIo.storeIdToBotId(currentBot.storeId);
              }
            }
          }
        })();

        dispatch({type: 'setBotId',botId: botId})
        
        // -------------------------------------------------
        // biomebot のdeploy 

      })();
    }

  }, []);


  // ---------------------------------------------------
  // broadcast channelの初期化
  //

  useEffect(() => {
    let ch;
    if (!state.channel) {
      ch = new BroadcastChannel('biomebot');
      dispatch({ type: 'setChannel', channel: ch });
    }
    return () => {
      if (ch) {
        ch.close();
      }
    };
  }, [state.channel]);

  return (
    <BiomebotContext.Provider
      value={{
        state: state,
      }}
    >
      {children}
    </BiomebotContext.Provider>
  );
}