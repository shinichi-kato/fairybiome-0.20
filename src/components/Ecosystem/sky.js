/*
  dayCycle.js
  ============================================
  日の出・日没の時刻を概算し、そこから現在の
  昼夜の状況を生成する。

  
*/

import * as ecosystem from './ecosystem';

/**
 * month,dateの日の日没、夜明け周辺の時刻を00:00からの延べ分で返す
 * @param {integer} month 
 * @param {integer} date
 * @return {array} 
 */
export function getDayCycle(month, date) {
  return {
    sunrise: getSunrise(month, date),
    sunset: getSunset(month, date)
  }
}



/**
 * 時間に応じたグラデーションのcssのlinear-gradient文字列を生成
 * @param {*} dayCycle 日没・日の出を示すtotalMin
 * @param {*} totalMin 00:00からの延べ分(totalMin)
 */
export function getGradation(dayCycle, totalMin) {
  function _getPalette() {
    const sc = ecosystem.SKY_COLORS;

    if (totalMin < 12 * 60) {
      // 午前
      if (totalMin < dayCycle.sunrise) {
        // 日の出前
        let offset = totalMin - dayCycle.sunrise + 60;
        if (offset < 0) {
          offset = totalMin - dayCycle.sunrise + 120;
          if (offset < 0) {
            return [sc.NIGHT, sc.NIGHT, 0]
          } else {
            return [sc.NIGHT, sc.DAWN, offset]
          }
        } else {
          return [sc.DAWN, sc.SUNRISE, offset];
        }
      }
      else {
        // 日の出後
        let offset = totalMin - dayCycle.sunrise - 60;
        if (offset < 0) {
          return [sc.SUNRISE, sc.MORNING, offset+60];
        } else {
          offset = totalMin - dayCycle.sunrise - 120;
          if (offset<0) {
            return [sc.MORNING, sc.BEFORENOON, offset+60];
          } else {
            return [sc.BEFORENOON, sc.BEFORENOON, 0];
          }
        }
      }

    } else
      // 午後
      if (totalMin < dayCycle.sunset) {
        let offset = totalMin - dayCycle.sunset + 60;
        if (offset < 0) {
          offset = totalMin - dayCycle.sunset + 120;
          if (offset < 0) {
            return [sc.AFTERNOON, sc.AFTERNOON, 0]
          } else {
            return [sc.AFTERNOON, sc.EVENING, offset]
          }
        } else {
          return [sc.EVENING, sc.SUNSET, offset]
        }
      } else {
        let offset = totalMin + dayCycle.sunset - 60;
        if (offset < 0) {

          return [sc.SUNSET, sc.DUSK, offset]
        } else {
          offset = totalMin - dayCycle.sunset - 120;
          if (offset<0) {
            return [sc.DUSK, sc.NIGHT, offset+120]
          } else {
            return [sc.NIGHT, sc.NIGHT, 0]
          }
        }
      }
  }

  const palette = _getPalette();

  /* paletteには
   [ 
     {top:[r,g,b],mid:[r,g,b],btm:[r,g,b]}, //offset 0地点のグラデーション
     {top:[r,g,b],mid:[r,g,b],btm:[r,g,b]}, //offset 60地点のグラデーション
     offset
   ]
   が格納されている。
   offsetは0から60までの値を取り、0の場合palette[0],60の場合palette[1]と
   なるように中間色を計算する。
   */
  const interpolate = (start, end, factor) => {
    return start.map((s, i) => Math.round(s + (end[i] - s) * factor));
  };

  const factor = palette[2] / 60;
  const top = interpolate(palette[0].top, palette[1].top, factor);
  const mid = interpolate(palette[0].mid, palette[1].mid, factor);
  const btm = interpolate(palette[0].btm, palette[1].btm, factor);

  return `linear-gradient(to bottom, rgb(${top.join(' ')}), rgb(${mid.join(' ')}), rgb(${btm.join(' ')}))`;
}

/**
 * 現在のecosystem状態から昼夜イベントを発火
 * @param {*} updated 
 */
export function getLatestDayEvent(updated){

}


/**
 * month,dateで指定した日付の日の出時刻を返す
 * @param {integer} month 
 * @param {integer} date
 * @return {array} [hour,min]日の出時刻 
 */
export function getSunrise(month, date) {
  const erl = ecosystem.SOLAR_CYCLE.sunrise.latest;
  const ere = ecosystem.SOLAR_CYCLE.sunrise.earliest;

  const x = -Math.cos(date2yearRad(month, date) - date2yearRad(erl.date[0], erl.date[1]));
  const sl = erl.time[0] * 60 + erl.time[1];
  const se = ere.time[0] * 60 + ere.time[1];
  const a = (se - sl) / 2.0;
  const b = (se + sl) / 2.0;
  const y = a * x + b; // 00:00からののべ分
  // const hh = Math.floor(y / 60);
  // const mm = Math.round(y % 60);
  // return [hh, mm];  

  return y
}
/**
 * month,dateで指定した日付の日没時刻を返す
 * @param {integer} month 
 * @param {integer} date 
 * @return {array} [hour,min]日没時刻
 */
export function getSunset(month, date) {
  const esl = ecosystem.SOLAR_CYCLE.sunset.latest;
  const ese = ecosystem.SOLAR_CYCLE.sunset.earliest;

  const x = -Math.cos(date2yearRad(month, date) - date2yearRad(esl.date[0], esl.date[1]));
  const sl = esl.time[0] * 60 + esl.time[1];
  const se = ese.time[0] * 60 + ese.time[1];
  const a = (se - sl) / 2.0;
  const b = (se + sl) / 2.0;
  const y = a * x + b; // 00:00からののべ分
  // const hh = Math.floor(y / 60);
  // const mm = Math.round(y % 60);
  // return [hh, mm];
  return y
}

/**
 * hour,minをradに変換
 * @param {*} hour 
 * @param {*} min 
 */
export function time2dateRad(hour, min) {
  const ms = Number(hour) * 60 * 60 + Number(min) * 60;
  const msStart = 0;
  const msEnd = 23 * 60 * 60 + 59 * 60;
  const rad = ((ms - msStart) / (msEnd - msStart)) * 2.0 * Math.PI;
  return rad;
}

/**
 * 00:00というフォーマットの文字列をradに変換
 * @param {*} str
 */
export function timeStr2dateRad(str) {
  const [h, m] = str.split(':');
  return time2dateRad(h, m);
}

/**
 * month,dateで指定した日付をradに変換
 * @param {*} month 
 * @param {*} date 
 */
export function date2yearRad(month, date) {
  const ms = Number(month) * 31 + Number(date);
  const msStart = 0;
  const msEnd = 12 * 31 + 31;
  const rad = ((ms - msStart) / (msEnd - msStart)) * 2.0 * Math.PI;
  return rad;
}

/**
 * 12/23というフォーマットの文字列をradに変換
 * @param {*} str
 */
export function dateStr2yearRad(str) {
  const [m, d] = str.split('/');
  return date2yearRad(m, d);
}