/*
BiomebotProvider-021
====================

biomebotのインスタンス管理、排他制御、入出力の流れの整理

deploy環境から接続した場合一般ユーザ(同時接続0-50人程度)となり、
develop環境から接続した場合管理者(同時接続1名)となる

## 一般ユーザモード

### 個人ルーム /room
ユーザはチャットボットと１対多で会話できる。チャットボットの出現は
確率的であり、ユーザの声掛けでも出現する可能性がある。
チャットボットが現れる前にbroadcastチャンネルで同botIdのボットの
生存確認を行い、ほかが存在しない場合のみ現れることができる。
(ブラウザ内ロック)

部屋の名前や背景画像などはユーザが設定できる。

### 共通ルーム /commons/0 〜 
/commons/0などを開くと複数のユーザ、複数のチャットボットが会話
できる。チャットボットの出現は確率的であり、ユーザの
声掛けでも出現する可能性がある。チャットボット出現前にcommonsの
どこかに同botIdのボットが生存しているか確認し、不在の場合のみ
出r源することができる。つぎにbroadcastチャンネルで同botIdの
ボットが生存しているか確認し、roomにいたら退室させる。

commonsで同botIdのボットが生存しているかどうかはfirestoreの
lockファイルを購読し、確認することで調べる

サーバーとなっているブラウザが破棄された場合、lockは放置状態に
なり、次に発言したユーザのブラウザがサーバーを引き継ぐ。

### 管理画面 /control
* roomやcommonsで稼働するすべてのworkerを停止、活性化、不活性化できる。

## 管理者モード

### 個人ルーム /room
動作は同じ

### 共通ルーム /commons/0〜
develop環境で /commons/0などの共通ルームを開くと観察モードになる。

### 管理画面 /control
develop環境で /controlを開くと
* roomやcommonsで稼働するすべてのworkerを停止、活性化、不活性化できる。
* firestore上でロックがされていない場合は/commonsにチャットボットを
  投入できる。
* commonsの数、部屋名、背景画像などを設定できる

### ストアテスト /store


*/
import React, { useReducer, useRef, useEffect, createContext } from 'react';
import { useStaticQuery, graphql } from 'gatsby';

import Biomebot from './biomebot';

export const BiomebotContext = createContext();

const biomebotQuery = graphql`
query MyQuery {
  allConceptEntry {
    nodes {
      triples {
        object
        predicate
        subject
      }
      parent {
        ... on File {
          name
          relativeDirectory
        }
      }
    }
  }
  allBiomebotConfig {
    edges {
      node {
        badWeatherAppearanceAdjustment
        nighttimeAppearanceAdjustment
        goodWeatherAppearanceAdjustment
        daytimeAppearanceAdjustment
        spontaneousAppearanceRate
        parent {
          ... on File {
            name
            relativeDirectory
          }
        }
        summonAppearanceRate
      }
    }
  }
}
`;

/**
 * snapをチャットボットごとに分割
 * @param {object} snap
 * @returns [botId]: {[moduleName]:{ext:string, content:string}}
 */
function splitSnaps(snap) {
  let configs = {}
  for (let node of snap.data.allBiomebotConfig.nodes) {
    const p = node.parent;
    const botId = p.relativeDirectory;
    configs[botId] = {...node};
  }

  let concepts = {}
  for (let node of snap.data.allConceptEntry){
    const p = node.parent;
    const botId = p.relativeDirectory;
    if(!(botId in concepts)){
      concepts[botId] = [];
    }
    concepts[botId].push({moduleName: p.name, triples:[...node.triples]});
  }

  return [configs,concepts];
}

const initialState = {
  botIds: [],
  status: {},
  channel: {},
}

function reducer(state, action) {
  switch (action.type) {
    case 'init': {
      return {
        ...state,
        botIds: Object.keys(action.configs),
      }
    }
  }
}

export default function BiomebotProvider() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const botPool = useRef({});
  const snap = useStaticQuery(biomebotQuery);

  // -----------------------------------------------------------
  // Biomebot関連
  //

  useEffect(() => {
    if (state.botIds.length === 0) {
      const [configs,concepts] = splitSnaps(snap);
      for (let botId in configs) {
        botPool.current[botId] = new Biomebot(configs[botId],concepts[botId]);
      }
      dispatch({ type: 'init', configs: configs });
    }
  }, [state.botIds]);

  function handleGetStatus() {
    let status = {}
    for (let botId in state.botModules) {
      status[botId] = botPool.current[botId].getStatus();
    }
    
    dispatch({ type: 'getStatus', status: status });
    return status;
  }

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
        getStatus: handleGetStatus()
      }}
    >
      {children}
    </BiomebotContext.Provider>
  )
}