/*
人工環境
========
ユーザのマシン上で、チャットルームアプリ向けに人工環境を生成し、
定期的に発信します。
* 人工環境とは季節、昼夜、天候の３つで構成されます。
* デバッグのためこれらのパラメータをオーバーライドできます。
* 人工環境は同一ブラウザ・同一オリジンであればタブをまたいでも
* シングルトンとして動作します。

## 定期的に発信する情報(10sec周期)
{
  "yearRad": float, # 一年をラジアンに換算した値
  "dateRad": float, # 一日をラジアンに換算した値
  "season": [string, string] # ["summer","early"]など季節
  "dayPeriod": [string, linear-gradient文字列], # SKY_COLORSで定義されたdayPeriod名, 背景色
  "weather": string
}

## 人工環境
### 日付
例："yearRad": 0.2234443190
マシンのDate情報を利用し、現在の日付を表すラジアン値を報告します。
これは1年=2*PIとなる値で、ラジアン表記を使うことで12/31と1/1が近いことを
表現します。これは会話ログを学習データとするときに特徴量の一つとして
利用することを想定しています。

### 時刻
例： "dateRad": 0.8835129358
マシンのTime情報を利用し、現在の時刻を表すラジアン値を報告します。
これは1日=2*PIとなる値で、ラジアン表記を使うことで23:59と0:00が近いことを
表現します。これは会話ログを学習データとするときに特徴量の一つとして
利用することを想定しています。

### 季節
例："season": ["WINTER","MID"]

日付の値から現在の季節を["WINTER","SPRING","SUMMER","AUTUMN"]のいずれかの文字列で
発信します。これを利用してチャットルームアプリはUI上の背景を変えることができます。

また一つの季節は3ヶ月で、それを細分化した["EARLY","MID","LATE"]という属性を
持っています。この情報をチャットボットが利用することで季節の変わり目を会話の
きっかけに利用できます。

### 昼夜(日の出、日没)
例 dayPeriod: ["MIDNIGHT", 0.0245]
現時刻が夜か昼かの状況を報告します。
* 日の出時刻はSOLAR_CYCLE.sunriseのearliestを基準とし、
  一周期は1年、振幅はsunriseで指定した値となるcosカーブで近似します。
* 日没時刻はSOLAR_CYCLE.sunsetのearliestを基準に
  一周期は1年、振幅はsunriseで指定した値となるcosカーブで近似します。
* 夜明けの開始時刻は日の出の1h前、朝の開始時刻は日の出の1h後で長さ1hとします。
* 夕方はの開始時刻は日没の1h前、薄暮の開始時刻は日没の1h後で長さ1hとします。
* 昼は11:30-13:30で年間とおして固定です。
* 昼夜で連続的に変化する空の色をcssのlinear-gradientとして発信します

状況     メッセージ   背景色の例(top-middle-bottom)
-------------------------------------------------------------------
深夜     MIDNIGHT   #000200 #010302 #141916
夜明け   DAWN         #0c121c #333743 #ac8f74   
日の出   SUNRISE      #4d557a #9499b3 #f8e8cf
朝       MORNING        #6f85a6 #b2c5d5 #f6e8ba
午前中   LATE_MORNING   #8aa4c8 #bac9dd #e6ecf1
昼       NOON           #8aa4c8 #bac9dd #e6ecf1
午後     AFTERNOON      #8aa4c8 #bac9dd #e6ecf1
夕方     EVENING
日没     SUNSET
薄暮     DUSK
夜       NIGHT
-----------------------------------------------------------

### 天候(ランダム)
例：weather: "CLEAR"
Noise.jsを用いたフラクタルなランダム値(0〜1)を仮想気圧とします。
seedおよびscale値はコンストラクト時に供給します。
仮想気圧が高いほど好天、低いほど悪天候で、仮想気圧0~1を8区間に
分けWEATHER_MAPに従った天候を報告します。

天候 メッセージ
---------------
快晴  CLEAR
晴れ  SUNNY
曇り  CLOUDY
霧    FOGGY
雨    RAIN
台風  STROM
雪    SNOW
吹雪  BLIZZARD
---------------

# 
*/



/* eslint-disable */
// Artificial Environment SharedWorker (Gatsby/Webpack5対応)
// 10秒ごとに { yearRad, dateRad, season, dayPeriod, weather } を送信
// - yearRad/dateRad: 0..2π
// - season: ["WINTER"|"SPRING"|"SUMMER"|"AUTUMN", "EARLY"|"MID"|"LATE"]
// - dayPeriod: [SKY_COLORSの名前, linear-gradient文字列]
// - weather: WEATHER_MAPに基づく文字列
// デバッグ用オーバーライド: SET_OVERRIDE { season?, dayPeriod?, weather? }

type Port = MessagePort & { __id?: string };
const ports = new Set<Port>();

// =========================
// 既存資産（そのまま流用）
// =========================

const SOLAR_CYCLE = {
  sunset: {
    earliest: { date: [12, 7], time: [17, 0] }, // 12/7 17:00
    latest: { date: [7, 7], time: [19, 0] },    // 7/7  19:00
  },
  sunrise: {
    earliest: { date: [6, 7], time: [5, 0] },   // 6/7  05:00
    latest: { date: [1, 7], time: [7, 0] },     // 1/7  07:00
  },
};

// WEATHER_MAP（そのまま利用）
const weatherNameMap: Record<string, string> = {
  BLZ: 'BLIZZARD',
  SNW: 'SNOW',
  CLO: 'CLOUDY',
  SUN: 'SUNNY',
  CLE: 'CLEAR',
  FOG: 'FOGGY',
  RAI: 'RAIN',
  STM: 'STORM', // STROMではなくSTORM
};
const WEATHER_MAP: string[][] = [
  'BLZ SNW SNW CLO CLO SUN CLE CLE', // Jan
  'BLZ SNW SNW SNW CLO CLO SUN CLE', // Feb
  'RAI RAI FOG CLO CLO SUN SUN CLE', // Mar
  'RAI CLO CLO CLO CLO SUN CLE CLE', // Apr
  'RAI RAI CLO CLO SUN SUN CLE CLE', // May
  'STM RAI RAI RAI CLO CLO CLO SUN', // Jun
  'STM RAI RAI CLO CLO SUN CLE CLE', // Jul
  'STM STM RAI RAI CLO SUN CLE CLE', // Aug
  'STM RAI CLO CLO CLO SUN CLE CLE', // Sep
  'RAI RAI RAI CLO CLO SUN CLE CLE', // Oct
  'SNW RAI RAI CLO CLO SUN CLE CLE', // Nov
  'BLZ SNW RAI RAI CLO CLO SUN CLE', // Dec
].map(row => row.split(' ').map(code => weatherNameMap[code]));

// SKY_COLORS（ご提示のmakeSkyColorsで生成）
function makeSkyColors(data: { rgb: string[]; name: string }[]) {
  /*
  data= [
    {name: "ngt", rgb: ["000200","010302","141916"]},
  ]
    というリストから辞書
  {ngt: {top: [0,2,0], mid: [1,3,2], btm: [20,25,22]}}
  を生成する。
  rgbには3つのRGBカラーコードが記載され、それぞれ
  top, mid, btmに対応してカラーコードを10進数のリストに変換する。
  */
  const colors: Record<string, { top: number[]; mid: number[]; btm: number[] }> = {};
  data.forEach((item) => {
    const name = item.name;
    const rgb = item.rgb.map((color) => {
      return color.match(/.{2}/g)!.map((c) => parseInt(c, 16));
    });
    colors[name] = {
      top: rgb[0],
      mid: rgb[1],
      btm: rgb[2],
    };
  });
  return colors;
}

const SKY_COLORS = makeSkyColors([
  { rgb: ["000200", "010302", "141916"], name: "BEFOREDAWN" },
  { rgb: ["0C121C", "333743", "ac8f74"], name: "DAWN" },
  { rgb: ["4d557a", "9499b3", "f8e8cf"], name: "SUNRISE" },
  { rgb: ["6f85a6", "b2c5d5", "f6e8ba"], name: "MORNING" },
  { rgb: ["8aa4c8", "bac9dd", "e6ecf1"], name: "BEFORENOON" },
  { rgb: ["8aa4c8", "bac9dd", "e6ecf1"], name: "AFTERNOON" },
  { rgb: ["6f85a6", "d5c4b2", "ec8f69"], name: "EVENING" },
  { rgb: ["4d557a", "9499b3", "f3c2ac"], name: "SUNSET" },
  { rgb: ["0c121c", "333743", "ac8874"], name: "DUSK" },
  { rgb: ["000200", "010302", "141916"], name: "NIGHT" },
]);

// 「ecosystem」参照を解決（既存資産で使われていた名前）
const ecosystem = {
  SOLAR_CYCLE,
  SKY_COLORS,
};

// 日の出・日の入り（既存資産そのまま）
export function getSunrise(month: number, date: number) {
  const erl = ecosystem.SOLAR_CYCLE.sunrise.latest;
  const ere = ecosystem.SOLAR_CYCLE.sunrise.earliest;

  const x = -Math.cos(date2yearRad(month, date) - date2yearRad(erl.date[0], erl.date[1]));
  const sl = erl.time[0] * 60 + erl.time[1];
  const se = ere.time[0] * 60 + ere.time[1];
  const a = (se - sl) / 2.0;
  const b = (se + sl) / 2.0;
  const y = a * x + b; // 00:00からののべ分
  return y;
}
export function getSunset(month: number, date: number) {
  const esl = ecosystem.SOLAR_CYCLE.sunset.latest;
  const ese = ecosystem.SOLAR_CYCLE.sunset.earliest;

  const x = -Math.cos(date2yearRad(month, date) - date2yearRad(esl.date[0], esl.date[1]));
  const sl = esl.time[0] * 60 + esl.time[1];
  const se = ese.time[0] * 60 + ese.time[1];
  const a = (se - sl) / 2.0;
  const b = (se + sl) / 2.0;
  const y = a * x + b; // 00:00からののべ分
  return y;
}

/**
 * month,dateの日の日没、夜明け周辺の時刻を00:00からの延べ分で返す
 */
export function getDayCycle(month: number, date: number) {
  return {
    sunrise: getSunrise(month, date),
    sunset: getSunset(month, date),
  };
}

/**
 * 時間に応じたグラデーションのcssのlinear-gradient文字列を生成
 * @param dayCycle 日没・日の出を示すtotalMin
 * @param totalMin 00:00からの延べ分(totalMin)
 */
export function getGradation(dayCycle: { sunrise: number; sunset: number }, totalMin: number) {
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
            return [sc.NIGHT, sc.NIGHT, 0] as const;
          } else {
            return [sc.NIGHT, sc.DAWN, offset] as const;
          }
        } else {
          return [sc.DAWN, sc.SUNRISE, offset] as const;
        }
      }
      else {
        // 日の出後
        let offset = totalMin - dayCycle.sunrise - 60;
        if (offset < 0) {
          return [sc.SUNRISE, sc.MORNING, offset + 60] as const;
        } else {
          offset = totalMin - dayCycle.sunrise - 120;
          if (offset < 0) {
            return [sc.MORNING, sc.BEFORENOON, offset + 60] as const;
          } else {
            return [sc.BEFORENOON, sc.BEFORENOON, 0] as const;
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
            return [sc.AFTERNOON, sc.AFTERNOON, 0] as const;
          } else {
            return [sc.AFTERNOON, sc.EVENING, offset] as const;
          }
        } else {
          return [sc.EVENING, sc.SUNSET, offset] as const;
        }
      } else {
        let offset = totalMin + dayCycle.sunset - 60;
        if (offset < 0) {
          return [sc.SUNSET, sc.DUSK, offset] as const;
        } else {
          offset = totalMin - dayCycle.sunset - 120;
          if (offset < 0) {
            return [sc.DUSK, sc.NIGHT, offset + 120] as const;
          } else {
            return [sc.NIGHT, sc.NIGHT, 0] as const;
          }
        }
      }
  }

  const palette = _getPalette();

  // palette: [startColors, endColors, offset(0..60)]
  const interpolate = (start: number[], end: number[], factor: number) => {
    return start.map((s, i) => Math.round(s + (end[i] - s) * factor));
  };

  const factor = (palette[2] as number) / 60;
  const top = interpolate(palette[0].top, palette[1].top, factor);
  const mid = interpolate(palette[0].mid, palette[1].mid, factor);
  const btm = interpolate(palette[0].btm, palette[1].btm, factor);

  return `linear-gradient(to bottom, rgb(${top.join(' ')}), rgb(${mid.join(' ')}), rgb(${btm.join(' ')}))`;
}

// 期日/時刻 → ラジアン（規定: 0..2π）
export function time2dateRad(hour: number | string, min: number | string) {
  const ms = Number(hour) * 60 * 60 + Number(min) * 60;
  const msStart = 0;
  const msEnd = 23 * 60 * 60 + 59 * 60;
  const rad = ((ms - msStart) / (msEnd - msStart)) * 2.0 * Math.PI;
  return rad;
}
export function timeStr2dateRad(str: string) {
  const [h, m] = str.split(':');
  return time2dateRad(h, m);
}
export function date2yearRad(month: number | string, date: number | string) {
  const ms = Number(month) * 31 + Number(date);
  const msStart = 0;
  const msEnd = 12 * 31 + 31;
  const rad = ((ms - msStart) / (msEnd - msStart)) * 2.0 * Math.PI;
  return rad;
}
export function dateStr2yearRad(str: string) {
  const [m, d] = str.split('/');
  return date2yearRad(m, d);
}

// =========================
// 仕様補完: 季節ラベル
// =========================
function calcSeason(d: Date): ['WINTER'|'SPRING'|'SUMMER'|'AUTUMN', 'EARLY'|'MID'|'LATE'] {
  const m = d.getMonth() + 1; // 1..12
  const day = d.getDate();

  let main: 'WINTER'|'SPRING'|'SUMMER'|'AUTUMN';
  if (m === 12 || m <= 2) main = 'WINTER';
  else if (m >= 3 && m <= 5) main = 'SPRING';
  else if (m >= 6 && m <= 8) main = 'SUMMER';
  else main = 'AUTUMN';

  const sub = (day <= 10) ? 'EARLY' : (day <= 20) ? 'MID' : 'LATE';
  return [main, sub];
}

// =========================
// dayPeriod名の判定（SKY_COLORSのキーで返す）
// =========================
function calcDayPeriodName(month: number, day: number, totalMin: number): keyof typeof SKY_COLORS {
  const cycle = getDayCycle(month, day);
  const sr = cycle.sunrise;
  const ss = cycle.sunset;

  if (totalMin < sr - 120) return 'NIGHT';              // 夜
  if (totalMin < sr - 60)  return 'BEFOREDAWN';         // 夜明け前(前半)
  if (totalMin < sr)       return 'DAWN';               // 夜明け(後半)
  if (totalMin < sr + 60)  return 'SUNRISE';            // 日の出直後
  if (totalMin < sr + 120) return 'MORNING';            // 朝→午前
  // 昼（仕様: 11:30-13:30 固定）だが SKY_COLORS には NOON がないため、
  // BEFORENOON/AFTERNOON の遷移域として扱う
  if (totalMin < 11*60 + 30) return 'BEFORENOON';
  if (totalMin < ss - 120)   return 'AFTERNOON';
  if (totalMin < ss - 60)    return 'EVENING';          // 夕方(前半)
  if (totalMin < ss)         return 'SUNSET';           // 日没
  if (totalMin < ss + 60)    return 'DUSK';             // 薄暮(前半)
  return 'NIGHT';                                       // 夜(以降)
}

// =========================
// 天候（Noise.js or フォールバック）
// =========================
declare const Noise: any; // Noise.js が存在すれば使う

function mulberry32(seed: number) {
  return function() {
    let t = (seed += 0x6D2B79F5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function pseudoNoise(seed: number, tSec: number) {
  const base = Math.floor(tSec / 3600);
  const r1 = mulberry32(seed + base)();
  const r2 = mulberry32(seed + base + 1)();
  const frac = (tSec % 3600) / 3600;
  return r1 * (1 - frac) + r2 * frac; // 0..1 平滑化
}

type WeatherOpts = { seed: number; scale: number };
const DEFAULT_WEATHER: WeatherOpts = { seed: 12345, scale: 3600 };

function noise01(nowSec: number, monthIdx: number, opts: WeatherOpts): number {
  try {
    if (typeof Noise !== 'undefined') {
      const n = new Noise(opts.seed + monthIdx * 1000);
      const v = n.perlin2(nowSec / opts.scale, monthIdx / 12);
      return Math.max(0, Math.min(1, (v + 1) / 2));
    }
  } catch {}
  return pseudoNoise(opts.seed + monthIdx * 1000, nowSec);
}

function calcWeather(d: Date, opts: WeatherOpts): string {
  const monthIdx = d.getMonth(); // 0..11
  const nowSec = Math.floor(d.getTime() / 1000);
  const n = noise01(nowSec, monthIdx, opts);
  const idx = Math.max(0, Math.min(7, Math.floor(n * 8)));
  return WEATHER_MAP[monthIdx][idx];
}

// =========================
// オーバーライド
// =========================
type OverrideState = {
  season?: [string, string] | null;
  dayPeriod?: [string, string] | null; // [name, gradientCSS]
  weather?: string | null;
};
const override: OverrideState = {
  season: null,
  dayPeriod: null,
  weather: null,
};

// =========================
// ペイロード生成
// =========================
function buildPayload(): any {
  const d = new Date();
  const month = d.getMonth() + 1;
  const day = d.getDate();
  const totalMin = d.getHours() * 60 + d.getMinutes();

  const yr = date2yearRad(month, day);          // 0..2π
  const dr = time2dateRad(d.getHours(), d.getMinutes()); // 0..2π

  const seas = override.season ?? calcSeason(d);

  const dayCycle = getDayCycle(month, day);
  const periodName = calcDayPeriodName(month, day, totalMin);
  const gradient = getGradation(dayCycle, totalMin);
  const dp = override.dayPeriod ?? [periodName, gradient];

  const wthr = override.weather ?? calcWeather(d, DEFAULT_WEATHER);

  return {
    yearRad: Number(yr.toFixed(10)),
    dateRad: Number(dr.toFixed(10)),
    season: seas,
    dayPeriod: dp,   // [SKY_COLORS名, linear-gradient文字列]
    weather: wthr,
  };
}

// =========================
// ブロードキャスト・接続
// =========================
let timer: number | null = null;

function broadcast(message: any) {
  for (const p of ports) {
    try { p.postMessage(message); } catch {}
  }
}
function startTicker() {
  if (timer != null) return;
  broadcast({ type: 'ENV', payload: buildPayload() });
  timer = setInterval(() => {
    broadcast({ type: 'ENV', payload: buildPayload() });
  }, 10_000) as unknown as number;
}
function stopTickerIfNoPorts() {
  if (ports.size === 0 && timer != null) {
    clearInterval(timer as any);
    timer = null;
  }
}

onconnect = (e: any) => {
  const port: Port = e.ports[0];
  port.__id = Math.random().toString(36).slice(2);
  ports.add(port);
  port.start?.(); // Safari 互換

  port.postMessage({ type: 'READY', portId: port.__id, connections: ports.size });
  port.postMessage({ type: 'ENV', payload: buildPayload() });

  startTicker();

  port.onmessage = (event: MessageEvent) => {
    const msg = (event as any).data || {};
    switch (msg.type) {
      case 'PING':
        port.postMessage({ type: 'PONG', at: Date.now() });
        return;

      case 'SET_OVERRIDE':
        // { season?, dayPeriod?, weather? } を設定
        if ('season' in msg) override.season = msg.season ?? null;
        if ('dayPeriod' in msg) override.dayPeriod = msg.dayPeriod ?? null;
        if ('weather' in msg) override.weather = msg.weather ?? null;
        port.postMessage({ type: 'ENV', payload: buildPayload() });
        return;

      case 'DISCONNECT':
        try { port.close(); } catch {}
        ports.delete(port);
        stopTickerIfNoPorts();
        return;

      default:
        port.postMessage({ type: 'ENV', payload: buildPayload() });
        return;
    }
  };

  port.addEventListener?.('close', () => {
    ports.delete(port);
    stopTickerIfNoPorts();
  });
};
