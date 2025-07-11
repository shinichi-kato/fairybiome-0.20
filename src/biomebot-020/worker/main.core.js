/*
biomebot main part
================================================

メインパートは以下の機能を持つ。
・文中の語彙を{memory}タグや{:concept}タグに置き換える辞書の生成
・ユーザやチャットボットに関する知識の問い合わせや学習
・UIから受け取ったメッセージをパートに転送する
・所定時間ごとにパートからのメッセージを集めて返答にする

*/

import { botIo } from '../botIo';

export const main = {
  botId: null,
  userConcept: null,
  botConcept: "",
  avatarDir: "",
  backgroundColor: "#cccccc",
  surfaces: {},
  listens: [],
  channel: new BroadcastChannel('biomebot020'),

  deploy: async ({ worker, botId, userConcept, summon }) => {
    main.worker = worker;
    main.botId = botId;
    main.userConcept = userConcept;
    main.botConcept = `{:${botId.toUpperCase()}}`;
    main.summon = summon;

    main.avatarDir = botIo.executeX(
      `select ?x where ${main.botConcept} {:avatarDir} ?x`,
      botId);
    main.backgroundColor = botIo.executeX(
      `select ?x where ${main.botConcept} {:backgroundColor} ?x`,
      botId);

    // タグ辞書生成
    const sd = await botIo.buildSurfaceDict(botId);
    main.surfaces = {
      surfaceToTag: sd,
      surfaceList: Object.keys(sd).sort((a, b) => b.length - a.length)
    };

    // listenパターンを生成
    main.listens = this._generateListenPatterns(botId.execute(
      `select ?name,?pattern where ?name {:listen} ?pattern`, botId
    ))

    // メッセージスプールの設定
    main.proposalSpool = [];
  },

  start: async () => {
    // ログがなければ生成
    const today = (new Date()).toLocaleDateString("jp-JP");
    const logTag =`${main.userConcept}:${dateStringToTag(today)}`;
    const log = await botIo.multiStoreExecute(`select ?x where ${main.userConcept} {:localeDate} ${today}`,[`${botId}:gained`]);
    if(log.length === 0){
      await botIo.cs.insert(`
        {${main.userConcept}} {:files} {${logTag}}
        {${logTag}} {:localeDate} ${today}
        {${logTag}} {:sounds} {:WANTED}
        {${logTag}} {:taughtNewConcept} {:WANTED}
        `,`${bodId}:gained`
      );
    }

  },

  run: async () => {
    // 今日のログに{:WANTED}を満足した記憶がなければ
    // それを質問する
    // ログの{:WANTED}満足の個数に対して質問するかどうかの傾向を{:curiosity}で定義
  },

  _generateListenPatterns(records) {
    return records.map(rec => {
      // rec["?x"] 例: "user {YOU}のこと?nicknameって呼んでいい？ => select {user} where {user} {:called} ?nickname."
      const [patternStr, sentence] = rec["?x"].split("=>").map(s => s.trim());
      // ?nameのような部分を名前付きキャプチャに変換
      // 例: "?nickname" → "(?<nickname>.+?)"
      const regexStr = patternStr.replace(/\?([a-zA-Z0-9_]+)/g, (_, name) => `(?<${name}>.+?)`);
      const pattern = new RegExp(regexStr);
      return {
        pattern,
        sentence
      };
    });
  },

  _tagify(str) {
    const d = main.surfaceDict.surfaceToTag;
    for(const t of main.surfaceDict.surfaceList){
      str = str.replace(t,d[t]);
      return str;
    }
  }
}

function dateStringToTag(date){
  const [y,m,d] = date.split('/');
  return `${y}${m.padStart(2,"0")}${d.padStart(2,"0")}`
}


