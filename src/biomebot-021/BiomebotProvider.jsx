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

## 排他制御
1. 同じbotIdのチャットボットはブラウザやマシンをまたいで
   commons内に同時に最大一つ存在できる。
2. 1に反しない限り、同じbotIdのチャットボットは
   ブラウザ内に同時に最大一つ存在できる。

### room
* チャットボット起動を試みたとき、botIdのbroadcastチャンネルの活動が
  観測できない(heartbeatがないか、タイムスタンプが古い)場合チャット
  ボットは不在とみなし、チャットボットは起動可能になる。
* チャットボットは実行中、発言がないときでもheartbeatメッセージを
  一定期間内にチャンネルに送る。
* 自分以外のheartbeatを検出したらチャットボットは退室しインスタンス
  は破棄する。

### commons
* firestore上の全commonsログを購読しておく。ログにはチャットボットの
  サーバーとなっているブラウザからチャットボットまたはユーザが
  発言したとき、ログにチャットボットのheartbeat情報を付加する。
  ログ中の{botId}に関するheartbeatが存在しないか古い場合、
  チャットボットは不在とみなして起動を許可する。
* ログ上でチャットボットの生存を確認したら、そのbotIdのチャンネルに
  heatbeatをリピートする。

*/
import React, { useReducer, useRef, useEffect, createContext, useContext } from 'react';
import { useStaticQuery, graphql } from 'gatsby';

import { EcosystemContext } from '../components/Ecosystem/EcosystemProvider';
import Biomebot from './biomebot';

export const BiomebotContext = createContext();
const isBrowser = typeof window !== 'undefined';

const biomebotQuery = graphql`
query MyQuery {
  allConceptStore {
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
function splitSnapsByBotId(snap) {
  let config = {}
  console.log("snap=", snap)
  for (let node of snap.allBiomebotConfig.nodes) {
    const p = node.parent;
    const botId = p.relativeDirectory;
    config[botId].configs = { ...node };
  }

  let concepts = {}
  for (let node of snap.allConceptStore.nodes) {
    const p = node.parent;
    const botId = p.relativeDirectory;
    const moduleName = p.name;
    if(!(botId in concepts)){
      concepts[botId] = {};
    }
    if (!(moduleName in concepts[botId])) {
      concepts[botId][moduleName] = [];
    }
    concepts[botId][moduleName].push([...node.triples]);
  }

  let dialogs = {};
  for (let node of snap.all)

  return [configs, concepts];
}

const interpolate = (start, end, factor) => {
  return Math.round(start + (end - start) * factor);
};


function hexToLightness(hexColor) {
  // 先頭の # を除去
  const hex = hexColor.replace(/^#/, '');

  // RGBに分解
  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;

  // HSL変換のための最大・最小値
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);

  // 明度（Lightness）の計算
  const lightness = (max + min) / 2;

  return lightness;
}



const initialState = {
  botIds: [],
  botConfigs: {},
  botStatus: {},
  heartbeats: {},
  workerStatus: {},
  channels: {},
}

function reducer(state, action) {
  switch (action.type) {
    case 'init': {
      console.log("action", action)
      return {
        ...state,
        botIds: Object.keys(action.configs),
        channels: { ...action.channels },
        botStatus: { ...action.botStatus },
        botConfigs: { ...action.botConfigs }
      }
    }

    case 'getBiomebotStatus': {
      return {
        ...state,
        botStatus: action.botStatus,
        workerStatus: action.workerStatus
      }
    }

    case 'recieveHeartbeat': {
      const hb = state.heartbeats;
      return {
        ...state,
        heartbeats: {
          ...hb,
          [action.botId]:{
            ...hb[action.botId],
            timestamp: new Date(),
          }
        }
      }
    }

    default: {
      throw new Error(`BiomebotProvider:invalid action ${action}`)
    }
  }
}

export default function BiomebotProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const eco = useContext(EcosystemContext);
  const botPool = useRef({});
  const snap = useStaticQuery(biomebotQuery);

  // -----------------------------------------------------------
  // Biomebot関連
  //

  useEffect(() => {
    if (!isBrowser) return;
    if (state.botIds.length > 0) return;

    const [botConfigs, concepts] = splitSnapsByBotId(snap);
    const bots = botPool.current; // snapshot
    const channels = {};
    const cleanups = [];
    const botStatus = {};

    for (const botId of Object.keys(botConfigs)) {
      bots[botId] = new Biomebot(botId, botConfigs[botId], concepts[botId]);
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
        ch.addEventListener("message", event => {
          const action = event.data;
          switch (action.type) {
            case 'heartbeat': {
              // heatbeatを受信したら時刻を記録
              dispatch({ type: 'recieveHeartbeat', botId: botId });
              // 自分が起動していたらシャットダウンする    
            }
          }
        })


      }
    }

    dispatch({ type: 'init', configs: botConfigs, channels, botStatus, botConfigs });

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
    console.log("botStatus", botStatus)

    dispatch({ type: 'getBiomebotStatus', botStatus: botStatus });

    // workerのステータス問い合わせ
  }

  /**
   * チャットボットの自発的起動
   */
  async function encounter(botId) {
    /*
    自発的出現率はbotConfigs.spontaneousAppearanceRateの確率で決まるが、
    この確率に天候と時刻の補正がかかる。
    晴天時にはgoodWeatherAppearanceAdjustment、悪天候時には
    badWeatherAppearanceAdjustment値が確率に加算される。天気そのものは
    ecosystem.barometerで0〜1の連続値として取得できるため、補正値もその
    間の値となるよう比例配分する。

    | 天候   | eco.barometer | botConfigs                      |
    |--------|---------------|---------------------------------|
    | 悪天候 | 0             | badWeatherAppearanceAdjustment  |
    | 好天   | 1             | goodWeatherAppearanceAdjestment |
    
    また夜間はnighttimeAppearanceAdjustment,昼にはdaytimeAppearance
    Adjustmentが加算される。eco.backgroundが昼夜の空の色を示して
    いるため、その明度を0-1に変換して同様に補正する。
    */

    // step 1 ブラウザロックの確認
    const now = new Date();
    const hb = state.recievedHeartbeat?.[botId];
    if (hb && now - state.recievedHeartbeat[botId] < state.botConfig[botId].hearbeatInterval * 1000) {
      // 他のブラウザでインスタンスが生きている→起動しない
      return;
    }

    // step 2 出現ロール
    const bc = state.botConfigs[botId];
    const prob = bc.spontaneousAppearanceRate
      + interpolate(bc.badWeatherAppearanceAdjustment, bc.goodWeatherAppearanceAdjustment, eco.barometer)
      + interpolate(bc.nighttimeAppearanceAdjustment, bc.daytimeAppearanceAdjustment, hexToLightness(eco.backgroundColor));
    if (Math.random() > prob) {
      // 出現ロール失敗→起動しない
      return
    }

    // step 3 チャットボットの起動
    botPool.current[botId].start();

    

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