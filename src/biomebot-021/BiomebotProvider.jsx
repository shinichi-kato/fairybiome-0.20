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
const isBrowser = typeof window !== 'undefined';

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
    nodes {
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
`;

/**
 * snapをチャットボットごとに分割
 * @param {object} snap
 * @returns [botId]: {[moduleName]:{ext:string, content:string}}
 */
function splitSnaps(snap) {
  let configs = {}
  console.log("snap=",snap)
  for (let node of snap.allBiomebotConfig.nodes) {
    const p = node.parent;
    const botId = p.relativeDirectory;
    configs[botId] = { ...node };
  }

  let concepts = {}
  for (let node of snap.allConceptEntry.nodes) {
    const p = node.parent;
    const botId = p.relativeDirectory;
    if (!(botId in concepts)) {
      concepts[botId] = [];
    }
    concepts[botId].push({ moduleName: p.name, triples: [...node.triples] });
  }

  return [configs, concepts];
}

const initialState = {
  botIds: [],
  botStatus: {},
  workerStatus: {},
  channels: {},
}

function reducer(state, action) {
  switch (action.type) {
    case 'init': {
      console.log("action",action)
      return {
        ...state,
        botIds: Object.keys(action.configs),
        channels: { ...action.channels },
        botStatus: {...action.botStatus},
      }
    }

    case 'getBiomebotStatus': {
      return {
        ...state,
        botStatus: action.botStatus,
        workerStatus: action.workerStatus
      }
    }

    default: {
      throw new Error(`BiomebotProvider:invalid action ${action}`)
    }
  }
}

export default function BiomebotProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const botPool = useRef({});
  const snap = useStaticQuery(biomebotQuery);

  // -----------------------------------------------------------
  // Biomebot関連
  //

  useEffect(() => {
    if (!isBrowser) return;
    if (state.botIds.length > 0) return;

    const [configs, concepts] = splitSnaps(snap);
    const bots = botPool.current; // snapshot
    const channels = {};
    const cleanups = [];
    const botStatus = {};

    for (const botId of Object.keys(configs)) {
      bots[botId] = new Biomebot(botId, configs[botId], concepts[botId]);
      botStatus[botId] = bots[botId].getStatus();

      cleanups.push(() => {
        try {
          const d = bots[botId]?.destroy?.();
          if (d && typeof d.then === 'function') d.catch(() => { });
        } catch { }
      });

      if ('BroadcastChannel' in window) {
        const ch = new BroadcastChannel(`Biomebot-${botId}`);
        channels[botId] = ch;
        cleanups.push(() => { try { ch.close(); } catch { } });
      }
    }

    dispatch({ type: 'init', configs, channels,botStatus });

    return () => {
      for (const fn of cleanups) {
        try { fn(); } catch { }
      }
    };
  }, [state.botIds.length, snap]);

  /**
   * biomebotとそのworkersのステータスを収集
   * 
   */
  async function handleGetStatus() {

    // biomebotインスタンス（workerではない)のステータス問い合わせ
    let botStatus = {}
    for (let botId of state.botIds) {
      botStatus[botId] = botPool.current[botId].getStatus();
    }
    console.log("botStatus",botStatus)

    dispatch({ type: 'getBiomebotStatus', botStatus: botStatus });

    // workerのステータス問い合わせ
  }

  return (
    <BiomebotContext.Provider
      value={{
        botStatus: state.botStatus,
        getStatus: handleGetStatus
      }}
    >
      {state.botIds ? children : "loading..."}
    </BiomebotContext.Provider>
  )
}