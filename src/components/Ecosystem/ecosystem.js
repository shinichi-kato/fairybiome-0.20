/*
    日の出と日没の基準は以下の日時(JST)とする。
    日没が最も早い日：  12/7 17:00
    日没が最も遅い日：   7/7 19:00
    日の出が最も早い日： 6/7 05:00
    日の出が最も遅い日： 1/7 07:00        
*/
import Dexie from 'dexie';

export const UPDATE_INTERVAL = 2 * 60 * 1000;

export const CLIMATE_SCALE = 0.0000001;

export const DB = new Dexie('FairyBiome020Ecosystem');

DB.version(1).stores({
  fixedFeature: 'uid' // uid,weather,month, date,time
});

const weatherNameMap = {
  BLZ: 'BLIZZARDY',
  SNW: 'SNOWY',
  CLO: 'CLOUDY',
  SUN: 'SUNNY',
  CLE: 'CLEAR',
  FOG: 'FOGGY',
  RAI: 'RAINY',
  STM: 'STORMY',
};

export const WEATHER_MAP = [
  'BLZ SNW SNW CLO CLO SUN CLE CLE', // 1月
  'BLZ SNW SNW SNW CLO CLO SUN CLE', // 2月
  'RAI RAI FOG CLO CLO SUN SUN CLE', // 3月
  'RAI CLO CLO CLO CLO SUN CLE CLE', // 4月
  'RAI RAI CLO CLO SUN SUN CLE CLE', // 5月
  'STM RAI RAI RAI CLO CLO CLO SUN', // 6月
  'STM RAI RAI CLO CLO SUN CLE CLE', // 7月
  'STM STM RAI RAI CLO SUN CLE CLE', // 8月
  'STM RAI CLO CLO CLO SUN CLE CLE', // 9月
  'RAI RAI RAI CLO CLO SUN CLE CLE', // 10月
  'SNW RAI RAI CLO CLO SUN CLE CLE', // 11月
  'BLZ SNW RAI RAI CLO CLO SUN CLE', // 12月
].map((m) => m.split(' ').map((w) => weatherNameMap[w]));

export const SKY_COLORS = makeSkyColors([
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

export const SOLAR_CYCLE = {
  sunset: {
    earliest: {
      date: [12, 7],
      time: [17, 0],
    },
    latest: {
      date: [7, 7],
      time: [19, 0],
    },
  },
  sunrise: {
    earliest: {
      date: [6, 7],
      time: [5, 0],
    },
    latest: {
      date: [1, 7],
      time: [7, 0],
    },
  },
};


function makeSkyColors(data) {
  /*
  data= [
    {name: "ngt", rgb: ["000200","010302","141916"]},
  ]
    というリストから辞書
  {ngt: {top: [0,2,0], mid: [1,3,2], btm: [20,25,22]}}
  を生成する。rgbには3つのRGBカラーコードが記載され、それぞれ
  top, mid, btmに対応してカラーコードを10進数のリストに変換する。
  */
  const colors = {};
  data.forEach((item) => {
    const name = item.name;
    const rgb = item.rgb.map((color) => {
      return color.match(/.{2}/g).map((c) => parseInt(c, 16));
    });
    colors[name] = {
      top: rgb[0],
      mid: rgb[1],
      btm: rgb[2],
    };
  });
  return colors;
}