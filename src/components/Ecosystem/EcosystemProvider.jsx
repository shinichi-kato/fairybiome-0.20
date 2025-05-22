/*
EcosysProvider
====================================================

チャットルームの昼夜・天候を提供する。昼夜の変化および天候の変化は
現れる妖精の種類に影響し、状況に即した話題のトリガーにもなる。
昼夜は日本での日の出・日没時刻から概算する。天候はノイズ関数から
仮想的に生成する。
時刻とそれに応じて変動する昼夜の状況、天候は自動的に変化を続けるが、
デバッグのためそれらを固定する、または無指定とする機能を付与する。

また時刻と天気の値をworkerを含めた任意の場所で計算可能にするため、
indexedDB上に
db.version(1).stores({
    ecosystem: 'uid', // {uid, weather, date, time}
})

というデータを持ち、weatherやdate,timeに有効な値が指定されていた場合は
特徴量計算に常にその値を使用する。


## 昼夜
日の出と日没の時刻は日付から近似値を計算できる。それをもとに背景色を
変えることで昼夜を表現する。ローカル環境からは設定画面を操作でき、
時刻の補正ができる。昼夜の変化に応じて下記のようなメッセージを出力する。
タイムスタンプにより状況は一意に特定できるため、特徴量は設定しない。

状況    特徴量      メッセージ                 背景色(top-middle-bottom)
------------------------------------------------------------------------
深夜     ---      {ECOSYS_START_MIDNIGHT}   #000200 #010302 #141916
夜明け   ---      {ECOSYS_START_DAWN}         #0c121c #333743 #ac8f74   
日の出   ---      {ECOSYS_START_SUNRISE}      #4d557a #9499b3 #f8e8cf
朝       ---      {ECOSYS_START_MORNING}        #6f85a6 #b2c5d5 #f6e8ba
午前中   ---      {ECOSYS_START_LATE_MORNING}   #8aa4c8 #bac9dd #e6ecf1
昼       ---      {ECOSYS_START_NOON}           #8aa4c8 #bac9dd #e6ecf1
午後     ---      {ECOSYS_START_AFTERNOON}      #8aa4c8 #bac9dd #e6ecf1
夕方     ---      {ECOSYS_START_EVENING}
日没     ---      {ECOSYS_START_SUNSET}
薄暮     ---      {ECOSYS_START_DUSK}
夜       ---      {ECOSYS_START_NIGHT}
-------------------------------------------------------------------------------

日の出と日没の基準は以下の日時とする。
日没が最も早い日：  12/7 17:00
日没が最も遅い日：   7/7 19:00
日の出が最も早い日： 6/7 05:00
日の出が最も遅い日： 1/7 07:00

夜明けと朝は日の出の±1時間、夕方と薄暮は日没の±1時間
昼は11:30-13:30で固定とする。背景色は夜明け、日の出、朝などの中央時間で
基準となる色が定義され、それ以外は中間色を計算して表示する。

## 天候

天候はフラクタル的なノイズ関数に従って変化する。ユーザに通知する
情報はメッセージとして伝達される「雨が振り始めた」という
トリガ情報と特徴量として埋め込まれる「雨が降っている」という
レベル情報である。天候の変化チェックは2分ごとに行う。


天候   特徴量             メッセージ
-----------------------------------------------
快晴 {ECOSYS_CLEAR}     {ECOSYS_START_CLEAR}
晴れ {ECOSYS_SUNNY}     {ECOSYS_START_SUNNY}
曇り {ECOSYS_CLOUDY}    {ECOSYS_START_CLOUDY}
雨   {ECOSYS_RAIN}      {ECOSYS_START_RAIN}
台風 {ECOSYS_STORM}     {ECOSYS_START_STROM}
雪   {ECOSYS_SNOW}      {ECOSYS_START_SNOW}
吹雪 {ECOSYS_BLIZZARD}  {ECOSYS_START_BLIZZARD}
------------------------------------------------

*/

import React, {
  useReducer,
  useState,
  useEffect,
  createContext,
  useContext,
} from 'react';

import Box from '@mui/material/Box';
import useInterval from '../../useInterval';
import NoiseGenerator from './noise';

import { liveQuery } from 'dexie';
import { AuthContext } from '../Auth/AuthProvider';
import * as sky from './sky';
import * as ecosystem from './ecosystem';
import EcosystemDialog from './EcosystemDialog';
import { MessageFactory } from '../../message';

export const EcosystemContext = createContext();

const initialState = {
  uid: null,
  month: null,
  date: null,
  weather: null,
  barometer: 0.5, 
  background: "",
  dayState: null,
  dayCycle: null,
  fixed: {
    weather: null,
    month: null,
    date: null,
    hour: null,
    minute: null,
  },
  noise: new NoiseGenerator(1, ecosystem.CLIMATE_SCALE),
  channel: null,
  run: false,
}

/**
 * 状態管理
 * @param {Object} state 直前のstate
 * @param {Object} action stateに対する操作
 * @return {Object} 新しいstate
 */
function reducer(state, action) {
  // console.log('Ecosystem ', action);
  switch (action.type) {
    case 'UPDATE_FIXED':
      const fixed = action.fixed;

      let weather = fixed.weather; // nullも有効
      let dayCycle = state.dayCycle;
      let background = state.background;
      const month = fixed.month;
      const date = fixed.date;
      const hour = fixed.hour;
      const minute = fixed.minute;

      // 日付が指定された場合、それが現在と異なっていたらdayCycleは更新
      if (!dayCycle ||
        (month && month !== state.month) ||
        (date && date !== state.date)) {
        dayCycle = sky.getDayCycle(month, date);
        background = sky.getGradation(dayCycle, hour * 60 + minute)
      }

      // 指定された時刻がstateと異なっていたらbackgroundを更新
      if (!background ||
        (hour && hour !== state.hour) ||
        (minute && minute !== state.minute)) {
        background = sky.getGradation(dayCycle, hour * 60 + minute)
      }

      // ここからコーディング。nullは有効
      return {
        ...state,
        month: month || state.month,
        date: date || state.date,
        hour: hour || state.hour,
        minute: minute || state.minute,
        weather: weather,
        background: background,
        dayCycle: dayCycle,
        fixed: fixed,
        run: !(fixed.weather || fixed.month)
      }

    case 'UPDATE':
      return {
        ...state,
        ...action.updated,
        run: true,
      };
    case 'SET_CHANNEL':
      return {
        ...state,
        channel: action.channel
      }

    case 'SET_DAY_STATE': {
      return {
        ...state,
        dayState: action.dayState,
      };
    }

    case 'RUN': {
      return {
        ...state,
        run: true,
      };
    }

    case 'STOP': {
      return {
        ...state,
        run: false,
      };
    }

    default:
      throw new Error(`Unknown action type: ${action.type}`);
  }
}

/**
 * Ecosystem Provider
 * @param {*} children 
 */
export default function EcosystemProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [isOpenDialog, setIsOpenDialog] = useState(false);
  const auth = useContext(AuthContext);

  // ---------------------------------------------------
  // broadcast channelの初期化
  //

  useEffect(() => {
    let ch;
    if (!state.channel) {
      ch = new BroadcastChannel('biomebot');
      dispatch({ type: 'SET_CHANNEL', channel: ch });
    }
    return () => {
      if (ch) {
        ch.close();
      }
    };
  }, [state.channel]);

  // ----------------------------------------------------------
  // デバッグ用パラメータが変化したらupdateEcosystem
  //

  useEffect(() => {
    let subscription = null;

    if (auth.uid) {
      console.log("subscription ");
      subscription = liveQuery(() =>
        ecosystem.DB.fixedFeature
          .where('uid')
          .equals(auth.uid)
          .first()
      ).subscribe({
        next: (data) => {
            dispatch({ type: 'UPDATE_FIXED', fixed: data });
        },
        error: (error) => {
          console.error('EcosystemDB subscription error:', error);
        },
      });
    }

    return () => {
      subscription.unsubscribe();
    }
  }, [auth.uid]);


  // ----------------------------------------------------------
  // 人工環境の更新
  //

  /**
   * 
   * @param {*} data  
   */

  function updateEcosystem() {
    /*
    通常、ecosystemのパラメータのうちdateとtimeは実時間が使用され、weatherは
    そのtimestampに紐付いたランダム値になる。時間の変化によりecosystemの状態が
    変化するため、updateEcosystemはINTERVAL値で設定された時間間隔で常に
    呼び出されている。
    
    fixedはすべて設定されるか、すべて設定されないかの二択。設定されている場合は
    これらの更新を行わない。
    
    */

    const now = new Date();
    const month = now.getMonth() + 1;
    const date = now.getDate();
    const hour = now.getHours();
    const minute = now.getMinutes();
    let dayCycle = state.dayCycle;

    // 日付が変わっていたらdayCycleを更新
    if (month !== state.month || date !== state.date) {
      dayCycle = sky.getDayCycle(month, date);
    }

    // 空の更新
    const background = sky.getGradation(dayCycle, hour * 60 + minute);

    // 人工天候
    const barometer = state.noise.getValue(now);
    const weather = ecosystem.WEATHER_MAP[month][Math.round(barometer * 7)];

    return ({
      month: month,
      date: date,
      hour: hour,
      minute: minute,
      weather: weather,
      dayCycle: dayCycle,
      background: background,
      barometer: barometer,
    })

  }


  useInterval(() => {
    const updated = updateEcosystem();
    // 時刻の更新
    if (updated.weather !== state.weather) {
      sendMessage(`{ECOSYSTEM_START_${updated.weather}}`);
    }
    dispatch({
      type: 'UPDATE',
      updated: updated
    });


    // 直近のdayCycleイベントを発火
    // const latestEvent = getLatestEvent(updated);
    // if (latestEvent) {
    //   sendMessage(`{ECOSYSTEM_START_${latestEvent}}`);
    //   dispatch({ type: 'SET_DAfixedY_STATE', event: latestEvent });
    // }

  }, state.run ? ecosystem.UPDATE_INTERVAL : null);

  // -------------------------------------------------
  // メッセージの送出
  // チャットログとチャットボットの両方に送る

  /**
   * channelにメッセージをポストしログに書き込む
   * @param {*} message
   */
  function sendMessage(message) {
    const m = new MessageFactory(message, { ecoState: true }).toObject();
    state.channel.postMessage({
      type: 'input',
      message: m,
    });
    // addDoc(state.logRef, m);
  }

  function handleOpenDialog() {
    setIsOpenDialog(true);
  }

  function handleCloseDialog() {
    setIsOpenDialog(false);
  }

  return (
    <EcosystemContext.Provider
      value={{
        weather: state.weather,
        dayState: state.dayState,
        openDialog: handleOpenDialog,
        run: () => dispatch({ type: 'RUN' }),
        stop: () => dispatch({ type: 'STOP' }),
      }}
    >
      <Box
        sx={{
          width: "100%",
          height: "100vh",
          background: state.background
        }}
      >
        {isOpenDialog ?
          <EcosystemDialog
            uid={auth.uid}
            ecoState={state}
            closeDialog={handleCloseDialog}
          />
          :
          children
        }
      </Box>

    </EcosystemContext.Provider>
  );


}
