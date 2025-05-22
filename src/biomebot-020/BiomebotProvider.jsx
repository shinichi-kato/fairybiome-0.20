/*
BiomebotProvider
===========================
複数のパートが競争的に動作することで一つのキャラクタを形成する
チャットボット


## 登場するチャットボットの決定
0. 全チャットボットのgraphql上のデータは'origin'と呼び、最新版をすべてConceptStore,MemoryStore,
SequenceStore上にアップロードする。学習などにより獲得したデータは'gained'と呼び、ConceptStore,
MemoryStore,SequenceStoreとfirestoreで同期する。
ConceptStore上にはチャットボットの出現傾向を定義するパラメータが格納される。

1. チャットボットはユーザと会話を始めると当日のログがConceptStoreに残る。
同じ日に再びアプリを起動した場合は{:resumeTalkRate}の確率でこのチャットボットが
再び姿を見せるようになる。

2. 今日会話した妖精がいない場合はconceptStore上からランダムで妖精を選び、時間帯や天候ごとの
出現確率ロールに成功したら出現する。失敗したら成功するまで妖精の選択を繰り返す。

### 起動チャットボットの指定
現れるチャットボットを固定することができる。
`summon="aurula"|"iwatoko"|"sphaera"`で姿を見せるチャットボットを
指定でき、`initialPart=パート名`により起動する妖精の最初のパートを
設定することができる。指定しなかった場合は妖精の設定したパートが
ランダムに選ばれる。

## データ入出力
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
│    ├ main  # originのConceptStore,originのMemoryStore
│    ├ greeting
︙    ︙
│    └ story
└ common_knowledge

firestore上では

chatbots collection
└ Aurula document
  ├ catalogueデータ
    └ modules collection
        ├ main document
        │   ├ concept 会話によって獲得したConceptStoreデータ
        │   └ memory 会話によって獲得したMemoryStoreデータ

        ├ greeting document
        ︙
        └ story

とする。firestore上にはoriginである{:COMMON}も置かない。

■ graphql - conceptStore, memoryStore間の同期(origin)
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
  allPlainText {
    nodes {
      parent {
        ... on File {
          name
          relativeDirectory
          ext
        }
      }
      content
    }
  }
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
  // データのsyncとチャットボットの起動
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
            botIo.ms.setStoreId(currentBot.storeId);
            const resumeRate = await botIo.ms.retrieve("{RESUME_TALK_RATE}");
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