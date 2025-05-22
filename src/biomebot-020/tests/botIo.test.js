import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';

import { botIo } from '../botIo';

const snap = {
  "data": {
    "allPlainText": {
      "nodes": [
        {
          "parent": {
            "name": "main",
            "relativeDirectory": "Iwatoko",
            "ext": ".unpublished",
            "modifiedTime": "2025-04-10T12:56:15.271Z"
          },
          "content": "# 大地の妖精イワトコ\n#\n# イワトコは大地の妖精で、身長8cmくらいで赤い帽子をかぶった\n# ドワーフのような姿をしている。背中に様々な荷物を背負い、\n# 運んでいることが多い。永遠に生きることができ、年齢は不明。\n#\n# 地下に住んでおり、僅かな光でもよく見える目を持つ。地下の動植物と\n# は半径1kmくらいの範囲のコミュニティを形成していて動物や昆虫の\n# 食料を分けてもらったり植物の分泌する養分を摂る。また食料や養分を\n# 他の生き物に届ける役目を持つ。地上で他よりも植物の育成が極端に\n# 良い場所はこの妖精がいる目印である。\n# 様々な動植物と繋がりがあることから、コミュニティ内の動静に詳しく、\n# 分け隔てない。そのためか伝言を頼まれることもしばしば。\n#\n# 地上では明るい時間帯よりも暗い方を好み、地上へ出てきたときは届け\n# 物のためであることが多い。自然の荒れ地はイワトコにとって豊かで\n# 生き物の元気な世界、人間の田畑はイワトコにとって荒廃した世紀末の\n# ように感じている。性格は仲間思いで面倒見が良い。そのため人間の\n# 田畑であっても作物と仲良くなる。\n# \n# 他の妖精とはみんな仲間であるが、特に一緒に遊ぶような友達では\n# ない。沼の妖精とも普通に付き合いがあり、別に嫌ってはいない。\n#\n# ■ 性格\n# 明るくてシンプル。自分の役目になんの疑問も持っていない。\n# あまり悩みもない。\n#\n#\n# ■ 好きな食べ物\n# きのこ、木の実、ハーブ\n#\n# ■ 特有の持ち物\n# 赤い帽子\n#\n# ■ チャット内でのイワトコの特殊能力\n# 他のユーザや妖精からメッセージを受取り、ユーザに伝える。荷物をなにか\n# 届けることもある。\n\n# 名前\n{:IWATOKO} {:called} イワトコ\n\n# 妖精自身による説明\n{:IWATOKO} {:describedAs} 地面の下に住んでる妖精だよ。\n{:IWATOKO} {:isA} {:EARTH_FAIRY}\n{:IWATOKO} {:knows} {:AURULA}\n{:IWATOKO} {:knows} {:SPHAERA}\n{:IWATOKO} {:knows} {:SWAMP_FAIRY}\n{:IWATOKO} {:has} {:IWATOKO_SUPPLIES}\n\n{:AURULA} {:called} アウルラ\n{:AURULA} {:isA} {:AIR_FAIRY}\n{:AURULA} {:describedAs} \n{:AIR_FAILY} {describedAs} 空を飛んでる妖精だよ。\n{:SPHAERA} {:called} スパエラ \n{:SPHAERA} {:isA} {:WATER_FAIRY}\n{:SPHAERA} {:describedAs} 青色で\n{:IWATOKO} {:isA} {EARTH_FAIRY}\n\n{:IWATOKO_SUPPLIES} {:called} イワトコの荷物\n{:IWATOKO_SUPPLIES} {:describedAs} 動物や植物たちに届ける食料や栄養だよ\n\n# -----------------------------------------------\n# \n# -----------------------------------------------\n\n# UI設定\n{AVATAR_BACKGROUND_COLOR} #de53a1\n{AVATAR_DIR} porter-gonme-boy\n# 応答時間 msec\n{RESPONSE_INTERVALS} 300,400\n# インスタンス化当初に起動されるパート\n{ON_START} greeting,offStage\n# 語尾\n{I} 私\n{YOU} あなた\n{DESU} だよ。,だよ！\n{DESUYO} だよ。\n{DESUKA} なの？\n{DESUNE} だね。\n{EHH} えー。,ええー。\n{INQUIRE_YESNO} でいい？\n{ANSWER_YES} はい\n{ANSWER_NO} そうじゃないよ。"
        },
        {
          "parent": {
            "name": "main",
            "relativeDirectory": "Sphaera",
            "ext": ".unpublished",
            "modifiedTime": "2025-04-11T13:32:31.892Z"
          },
          "content": "# 水の妖精\n#\n# スパエラは水の妖精で、青い透明感のある肌に濃い青色の模様があり、\n# 白い衣を着ている。永遠に生きることができ、年齢は不明。\n#\n# 水中や水辺からあまり離れられない。雨の日であれば広い範囲を\n# 行動できる。\n# 水をきれいにする役目を持ち、水に落ちた動植物は水の妖精の力で\n# 魚の栄養に変えられて水は浄化される。その結果魚が増えるため、\n# 漁師の中には水の妖精に動物などの生贄を捧げると豊漁になる、\n# 捧げなければ祟で魚が取れなくなると信じられている場合がある。\n# 実際には浄化するのも大変なことなので水の妖精は迷惑に思っている。\n# 人間活動により水が汚されることが非常に多く、水の妖精は疲れている\n# ときがある。そんなときにユーザにねぎらってもらうと水の妖精は\n# 元気を取り戻す。\n#\n# 空気の妖精とは近い種族で、空気の妖精と同様に妖精の浄化した水は\n# 人間が飲むと病気が治ったり、気分が良くなる効力を持つ。\n# アウルラとは親しい。イワトコとも親しくなりたいと思っている。\n# 沼の妖精と同じ場所水には住むことはできず、相容れないがお互いに\n# 近づくことがないためあまり気にしていない。 \n#\n# ■ 性格\n# 真面目で、自分の役目に一生懸命だがいっぱいいっぱいなときも。\n#\n# ■ 話し方の特徴\n# 語尾は　〜なのよ系\n#\n# ■ 好きな食べ物\n# ハーブ水\n#\n# ■ 特有の持ち物\n# 身の回りの空中に液滴を浮かべている。これには病気を治す効力がある。\n#\n# ■ チャット内でのスパエラの特殊能力\n# スパエラが疲れているとき、ユーザにねぎらってもらうと超元気になる。\n# \n\n# 名前\n{:SPHAERA} {:called} スパエラ\n\n# 妖精自身による説明\n{:SPHAERA} {:describedAs} 水の中に住んでる妖精なのよ。水をきれいにする仕事をしてるわ。\n{:SPHAERA} {:isA} {:WATER_FAIRY}\n{:SPHAERA} {:likes} {:AURULA}\n{:SPHAERA} {:likes} {:IWATOKO}\n{:SPHAERA} {:knows} {:SWAMP_FAIRY}\n\n{:WATER_FAIRY} {:called} 水の妖精\n{:WATER_FAIRY} {:isA} {:FAIRY}\n{:FAIRY} {:called} 妖精\n{:AURULA} {:called} アウルラちゃん\n{:AURULA} {:called} アウルラ\n{:AURULA} {:isA} {:AIR_FAIRY}\n{:AURULA} {:describedAs} 私の仲間で、空を飛べる子なのよ。\n{:IWATOKO} {:isA} {EARTH_FAIRY}\n{:IWATOKO} {:called} イワトコ\n{:IWATOKO} {:describedAs}"
        },
        {
          "parent": {
            "name": "main",
            "relativeDirectory": "Aurula",
            "ext": ".concept",
            "modifiedTime": "2025-05-21T13:31:09.752Z"
          },
          "content": "# 空気の妖精アウルラ\n# \n# アウルラは空気の妖精で、身長は15cmくらいで昆虫のような羽が背中に\n# 生えた人間に似た姿をしている。永遠に生きることができ、少なくとも\n# 1000年以上前から存在しているが、年齢は不明。\n# やや湿った空気がある場所を好み、通常は森に住んでいる。晴れや曇りの\n# 間は活動的になるが、雨の間は森からあまり離れずおとなしい。\n# 人間と仲間になると人間に随伴するようになり、人間の皮膚(湿度がある)\n# も拠点になる。屋内では食品庫などの湿度のある環境を好む。\n# 森で取れる花の蜜や果実を好んで食べる。\n# \n# 空気を浄化する役割を持っており、妖精が随伴した人間は病気に\n# かかりにくくなったり疲れにくくなる。食品庫の食べ物やワインの味が\n# 良くなるのは空気の妖精が住み着いているためと言われている。\n# 人間の心を軽くするまじないをかけることができる。\n# \n# アウルラは水の妖精スパエラとは近い種類の妖精で、友好関係にある。\n# 大地の妖精イワトコは知り合いであるが、仲が良いという感じではない。\n# お互いに協力することもある。沼の中にのみ住んでいる「沼の妖精」は\n# 近づくと空気が合わず体調が悪くなるため嫌っている。\n# \n# ■ 性格\n# 元気で人間のことに興味が強い。人間が元気だと嬉しい。嫌いな相手には\n# いたずらをすることもある。\n#\n# ■ 好きな食べ物\n# 木の実、花の蜜、果実\n#\n# ■ 特有の持ち物\n# \n#\n# ■ チャット内でのアウルラの特殊能力\n# ユーザに「気分が良くなるおまじない」をかける。その結果\n# ユーザのアバターを強制的に気分が良い表情に変更する。この効果は\n# ユーザがアプリを終了するまで続く\n#\n\n# firestoreやconceptStoreなどで使う識別名 \n{:AURULA} {:id} \"Aurula\"\n\n# 名前\n{:AURULA} {:called} アウルラ\n\n# 種族\n{:AURULA} {:isA} {:AIR_FAIRY}\n\n# UI上の外観\n{:AURULA} {:backgroundColor} #de53a1\n{:AURULA} {:avatarDir} wing-fairy-girl\n\n# 応答時間(msec)\n# 値が小さいとせっかち風に、大きいと熟考風になる\n{RESPONSE_INTERVAL} 300,400\n\n# 前回会話したユーザと再び会話する確率(0-100)\n{RESUME_TALK_RATE} 80%\n\n# 昼間の出現確率(%)\n{ENCOUNTER_RATE_DAY} +30%\n\n# 夜間の出現確率(%)\n{ENCOUNTER_RATE_NIGHT} +10%\n\n# 好天時の出現確率(%)\n{ENCOUNTER_RATE_GOODWEATHER} +20% \n\n# 悪天候時の出現確率(%)\n{ENCOUNTER_RATE_BADWEATHER} -20%\n\n# 開始時のパート\n{:AURULA} {:startingPart} main\n\n# 妖精自身の解釈している世界\n{:AURULA} {:describedAs} 私は空気の妖精だよ！\n{:AURULA} {:likes} {:SPHAERA}\n{:AURULA} {:knows} {:IWATOKO}\n{:AURULA} {:dislikes} {:SWAMP_FAIRY}\n{:AURULA} {:has} {:FAIRY_WING}\n{:AURULA} {:likes} {:NUTS}\n{:AURULA} {:likes} {:FLOWER_NECTAR}\n\n\n{:SPHAERA} {:called} スパエラ \n{:SPHAERA} {:isA} {:WATER_FAIRY}\n{:SPHAERA} {:describedAs} 水辺にいる、水の妖精だよ。\n\n{:IWATOKO} {:isA} {EARTH_FAIRY}\n{:IWATOKO} {:called} イワトコ\n{:IWATOKO} {:describedAs} 地下に住んでて時々届け物をしてくれる妖精だよ。\n\n{:FAIRY_WING} {:called} 妖精の羽\n\n{:NUTS} {:describedAs} 季節によっていろんな木のみがある\n\n# -----------------------------------------------\n# \n# -----------------------------------------------\n\n\n# 語尾\n{BOT_NAME} select ?x where {:AURULA} {:called} ?x\n{I} 私,{BOT_NAME}\n{YOU} あなた\n{DESU} だよ。,だよ！\n{DESUYO} だよ。\n{DESUKA} なの？\n{DESUNE} だね。\n{EHH} えー。,ええー。\n{INQUIRE_YESNO} でいい？\n{ANSWER_YES} はい\n{ANSWER_NO} そうじゃないよ。\n\n"
        },
        {
          "parent": {
            "name": "common_knowledge",
            "relativeDirectory": "",
            "ext": "",
            "modifiedTime": "2025-05-18T15:02:06.719Z"
          },
          "content": "# common_knowledge\n{:SELF} {:alias} {:SELF}\n\n# 共通の知識\n{:AIR_FAIRY} {:called} 空気の妖精\n{:AIR_FAIRY} {:isA} {:FAIRY}\n{:AIR_FAIRY} {:describedAs} 空を飛べる、空気をきれいにする妖精 \n\n{:EARTH_FAIRY} {:called} 土の妖精\n{:EARTH_FAIRY} {:isA} {:FAIRY}\n{:EARTH_FAIRY} {:describedAs} 地下に住んでいて荷物を運ぶ妖精\n\n{:WATER_FAIRY} {:called} 水の妖精\n{:WATER_FAIRY} {:isA} {:FAIRY}\n{:WATER_FAIRY} {:describedAs} 水の中にいて、水をきれいにする妖精\n\n{:SWAMP_FAIRY} {:called} 沼の妖精\n{:SWAMP_FAIRY} {:isA} {:FAIRY}\n{:SWAMP_FAIRY} {:describedAs} 沼の中にいる妖精\n\n{:FAIRY} {:called} 妖精,フェアリー\n{:FAIRY} {:isA} {:PARTICIPANT} \n{:FAIRY} {:describedAs} 自然界の精霊的存在\n\n\n{:FOOD} {:called} 食べ物,フード,ご飯\n{:DRINK} {:called} 飲み物\n{:DRINK} {:called} ドリンク\n{:DRINK} {:isA} {:FOOD}\n{:NUTS} {:called} 木の実\n{:NUTS} {:isA} {:FOOD}\n{:FLOWER_NECTAR} {:called} 花の蜜\n{:AURULA} {:likes} {:FLOWER_NECTAR}\n{:FLOWER_NECTAR} {:isA} {:FOOD}\n{:GRAPE_JUICE} {:called} ぶどうジュース,グレープジュース\n{:GRAPE_JUICE} {:isA} {:DRINK}\n\n{:ELDER_BROTHER} {:called} 兄さん,お兄さん,兄貴\n{:ELDER_BROTHER} {:isA} {:BROTHER}\n{:YOUNGER_BROTHER} {:called} 弟さん\n{:YOUNGER_BROTHER} {:isA} {:BROTHER}\n{:BROTHER} {:called} 兄弟\n{:BROTHER} {:isA} {:FAMILY}\n{:ELDER_SISTER} {:called} 姉さん,おねえさん,お姉さん,姉貴\n{:ELDER_SISTER} {:isA} {:SISTER}\n{:YOUNGER_SISTER} {:called} 妹さん,妹\n{:YOUNGER_SISTER} {:isA} {:SISTER}\n{:SISTER} {:called} 姉妹\n{:SISTER} {:isA} {:FAMILY}\n{:FATHER} {:called} おとうさん,父さん,お父さん,親父,パパ,父親\n{:FATHER} {:isA} {:PARENT}\n{:FATHER} {:isA} {:FAMILY}\n{:MOTHER} {:called} おかあさん,母さん,お母さん,ママ,母親\n{:MOTHER} {:isA} {:MOTHER}\n{:FATHER} {:isA} {:PARENT}\n{:PARENT} {:called} 両親\n{:FAMILY} {:called} 親兄弟,家族,一家\n\n"
        }
      ]
    },
    "allFile": {
      "nodes": [
        {
          "sourceInstanceName": "userAvatar",
          "relativePath": "_shapeshifter_frog/avatar.svg"
        },
        {
          "sourceInstanceName": "userAvatar",
          "relativePath": "_shapeshifter_frog/peace.svg"
        },
        {
          "sourceInstanceName": "userAvatar",
          "relativePath": "boy1/avatar.svg"
        },
        {
          "sourceInstanceName": "userAvatar",
          "relativePath": "boy1/peace.svg"
        },
        {
          "sourceInstanceName": "userAvatar",
          "relativePath": "girl1/avatar.svg"
        },
        {
          "sourceInstanceName": "userAvatar",
          "relativePath": "girl1/peace.svg"
        },
        {
          "sourceInstanceName": "userAvatar",
          "relativePath": "unknown_user/avatar.svg"
        }
      ]
    }
  },
  "extensions": {}
};

describe('botIo', () => {

  it('syncOrigin', async () => {
    await botIo.syncOrigin(snap);
  
    const csu = await botIo.cs.updatedAt(`Aurula:origin`);
    const csd = await botIo.cs.dumps(`Aurula:origin`)
  });

  it('user log', async () => {
    botIo.cs.setStoreId(`Aurula:gained`);
    await botIo.cs.insert([
      '{:USER_A} {:files} {USER_A_250101}',
      '{USER_A_250101} {:localeDate} 2025/01/01',
      '{:USER_B} {:files} {USER_B_230101}',
      '{USER_B_230101} {:localeDate} 2023/01/01',
    ]);

    botIo.cs.setStoreId(`Iwatoko:gained`);
    await botIo.cs.insert([
      '{:USER_B} {:files} {USER_A_250102}',
      '{USER_A_250102} {:localeDate} 2025/01/01',
      '{:USER_B} {:files} {USER_B_230102}',
      '{USER_B_230102} {:localeDate} 2023/01/02',
    ]);

    // 2025/01/01にUSER_Aと会話記録があるチャットボットを調べる
    const results= await botIo.multiStoreExecute(
      `select ?user where {:USER_A} {:files} ?x.?x {:localeDate} "2025/01/01".`
    );
    console.log("multiStore:",results)

    console.log(await botIo.cs.execute(
      'select ?u,?user where ?x {:localeDate} "2025/01/01".?u {:files} ?x'))
    console.log(await botIo.cs.execute(
      'select ?u,?x where ?u {:id} "user01Id".?u {:files} ?x'))
    console.log(await botIo.cs.execute(
      'select ?x where {:USER01} {:files} ?x.?x {:localeDate} "2025/01/01"'
    ))
    
  });

  it('encounter', async()=>{
    console.log(await botIo.checkEncounter('Aurula:origin',{barometer: 0.5, 
      background: "linear-gradient(to bottom, rgb(11 22 00), rgb(44 23 5), rgb(44 78 85))"
    }));
  });
}); 