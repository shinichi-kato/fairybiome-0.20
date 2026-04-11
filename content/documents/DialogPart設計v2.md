
DialogPart - ログ型辞書を使ったパートチャットボットカーネルクラス
======================================


## 1. 会話ログの書式

```md
---
author: skato
description: 日々の挨拶
default:
    date: 9/12
    time: 13:30
    scene: 晴れ 
    expression: 平静 
tags: 
  {animal}: [ 犬,猫 ]
---

## 2/4 18:00 晴れ 室内
- user: こんにちは
- bot: [挨拶]こんにちは！
- user: いい天気だね！
- bot: {user}はどこか出かける？
- ゆう: テーマパークに行こう！
```

* ファイル先頭にはYAML Headerを書くことができ、筆者、説明、デフォルトの表情、このファイル内をスコープとするタグを記載してもよい。
* 会話は `##`で区切られ、`##`行には日付、時刻、天候、場所を記載し、これらは続くブロックに共通の特徴量として扱われる。`##` 以降に何も書かない場合、headerに書いたdefault血が使用される。
* 会話は`-`で始め、リストとして記載する。
* 各行が一つのセリフとなり、<話者>: <テキスト>という形式にする。
* テキストの中で`[挨拶]`など角括弧で書いた部分はチャットボットのavatar種類になる。
* テキストの中で`{user}`など波括弧で書いた部分はタグである。

## 2. 会話ログ利用した学習

登場人物の中で、botはチャットボット本人、userは対話の相手を示す。その他は第三者の会話なので、第三者やuserの発言をbotの発言にする場合は伝聞形にする。またこのログはどのユーザに対しても使われ、ログ上で「ゆう」という第三者のセリフとして書かれていてもチャットの相手が「ゆう」であればuserと同じとみなす。

### expression
ログの中で[]内にはノンバーバルな情報を書く。それらはいずれかのexpressionに割り当てられ、それぞれに対応したavatarの表示に使う。

| expression  | 表記                   |
|-------------|------------------------|
| neutral     | [平常]                 |
| waving      | [手を振る] [手を振って] [挨拶して]  |
| smile       | [笑い] [笑み] [笑]     | 
| thinking    | [悩み] [顎に手をやり] [考え込み] |
| agree       | [同意]                 |
| cheerful    | [嬉しい] [ご機嫌で] [楽しげに] [楽しそうに] |
| surprise    | [びっくり] [驚いて]    |
| dissapoint  | [がっかりして] [肩を落として] [へこんで] |
| side-eyed   | [ジト目] [疑いの目で] |
| sad         | [悲] [悲しい]          |
| anger       | [怒] [怒り]            |
| sleepy      | [眠] [眠そう]          |


## 3. 辞書の格納形式
* 辞書ソース(source)
  - botId, moduleName,isLearnedで識別。他は特徴量。
  - オリジナルのデータはgraphql経由で提供される。
  - 学習したデータはfirestoreを用いて共有される。
* メタデータ(meta)
  - 辞書を最新情報にsyncするために更新日付
  - 特徴量ごとの重み付け計数
* 計算キャッシュ(cache)
  - cos類似度計算に必要な類似度行列、ボキャブラリーなど

dexieJS上に以下の形式で格納する。

```typescript
// 辞書ソース
type sourceRow= {
  // 検索キー
  botId: string; // チャットボットId
  moduleName: string; // 辞書ソースのファイル名(話題)
  isLearned: 1 | 0;
  
  // 特徴量
  feature:{
    speaker: string; // bot | user | 名前 | cue
    expression: string; // アバターの表情
    text: string; // セリフなどの文字列
    date: string;  // "%m/%d" | null
    time: string; // "%H:%M" | null
    numOfSpeakers: string; , // 場にいる人数 1 | 2 | many
    sceneTags: sting; // 天候や部屋の状況 {ECO_SNOWY} | {ECO_START_SNOW} | {ECO_FINE} | ...
  }
};
// メタデータ
type meta = {
  botId: string; // fs上のbotId
  moduleName: string;
  isLearned: 1 | 0;
  updatedAt: datetime; // 更新日時
  hyperParams: {
    speaker: float, listener: float:,...
  }; // 特徴量ごとの重み付け計数辞書
};

// 類似度行列などの計算キャッシュ
type cache={
  botId: string; // fs上のbotId
  moduleName: string;
  listener; //
  ...
}

db.version(1).stores({
  source:'++id,[botId+moduleName+isLearned]',
  meta: '[botId+moduleName+isLearned]',
  cache: '[botId+moduleName+listener]'
})
```