/*
BiomebotProvider
===========================
複数のパートが競争的に動作することで一つのキャラクタを形成する
チャットボット


## 登場するチャットボットの決定
0. 全チャットボットの全botModuleは一度coceptStoreにロードした後firestoreにアップロードしておく。
各チャットボットのdocumentには更新日時、出現確率パラメータを集約。

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
チャットボットのオリジナルデータはgraphqlで供給される。
firestore上にデータがなければgraphqlのデータをindexedDB上にロードし、
その内容をfirestoreにアップロードする。
commonは全チャットボットで共有する常識のデータで、firebase上には
保存しない。
firestore上により新しいデータが存在したらindexedDB側にダウンロードする。
indexedDB側のデータのほうがfirestoreよりも新し場合、firestoreにアップロードする。
mainのファイルはsubjectによりいくつかに分割して保存する。
etcのデータは主にgraphqlから供給され、会話により更新される頻度は低い。
{:AURULA} は学習によって変化する可能性があるが、変化は少ない。また学習した部分は
graphqlに影響されない。
{:USER01}はユーザとの会話で生成されるデータでgraphql側にはデータがない。
このように大まかに更新頻度ごとに分割することでデータ更新量の最小化とメンテナンス
性の向上を図る。

botModules
├ Aurula
│    ├ main
│    ├ greeting
︙    ︙
│    └ story
└ common_knowledge

firestore上では

chatbots collection
└ Aurula document
  ├ updatesデータ
    └ modules collection
        ├ main document
        │   ├ {:AURULA} subjectが{:AURULA}のデータ
        │   ├ {:USER01} subjectが{:USER01}のデータ,userのログ情報
        │   └ etc subjectが上述以外のデータ
        ├ greeting document
        ︙
        └ story

とする。firestore上には{:COMMON}は置かない。
graphql-firestore間はファイルの更新日付を利用してsyncを行う。

firestoreとdexie間はデータを同じにする同期を最大一日一回行う。そのアクセス回数を減らすため、
main以外は{updates}に各モジュールの更新日付を記載し、新しい方に同期をする。


*/

import React, {
  useReducer, createContext,
  useContext,
} from 'react'
import { useStaticQuery, graphql } from 'gatsby';
import * as fs from './fsio';
import * as gq from './gqio';
import * as cs from './csio';

import { ConceptStore } from '../conceptStore/conceptStore';
import { WorkingMemoryStore } from '../workingMemoryStore/workingMemoryStore';

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
  globalConceptStore: new ConceptStore(),
  botConceptStore: new ConceptStore(),
  commonConceptStore: new ConceptStore("common"),
  workingMemoryStore: new WorkingMemoryStore(),
  fsUpdates: null,
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
  }
}

export default function BiomebotProvider({ firebase, firestore, summon, initialPart, children }) {
  const auth = useContext(AuthContext);
  const [state, dispatch] = useReducer(reducer, initialState);
  const snap = useStaticQuery(biomebotQuery);

  // ---------------------------------------------------
  // graphql - conceptStore間のsync
  // 

  useEffect(() => {
    if (state.conceptStore) {
      if (!state.fsUpdates) {
        (async () => {
          // gqにあってfsにないデータがあったら一旦conceptStoreに送ってfsにコピーする
          const fsc = await fs.getCatalogue(firestore);
          const gql = gq.getChatbotList(snap);
          const uploaded = {}

          for (let botId of gql) {
            if (!(botId in fsc)) {
              const csScript = [];
              const wmScript = [];
              const lines = gql[botId].split('\n');
              for (let line of lines) {
                line = line.trim();
                if (line.startsWith('#') || line === '') continue;
                if (line.startsWith('{:')) {
                  csScript.push(line);
                }else if(line.startsWith('{')) {
                  wmScript = [];
                }
              }
              state.conceptStore.setStoreId(botId);
              state.conceptStore.insert(csScript);
              
              let mainConcept = state.conceptStore.select('?x').where('?x {:id} ?y').first();
              mainConcept = mainConcept['?x'];

              const graph = state.conceptStore.toArray();

              fs.saveConcepts(
                botId,
                mainConcept,
                graph.filter(triple=>triple.s===mainConcept)
              )
              fs.saveConcepts(
                botId,
                'etc',
                graph.filter(triple=>triple.s!==mainConcept)
              )
            }
          }

          // catalogueを更新


        })();
      }

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
}