DialogPart - ログ型辞書を使ったパートチャットボットカーネルクラス
======================================
* このクラスはアプリ起動時にgraphql経由の辞書ソースとfirestoreを与えてインスタンス化
  する。アプリ初期化の中でsync()を実行することでdb上のデータを最新にし、learn()で
  db.cacheを更新する。reply(message)は外部からの入力を受取り、{score, innerText, sourceId}からなる返答を返す。
  render(sourceId)はsourceIdで示されるテキストを日本語に戻して出力する。

* このクラスはworkerを利用して並列動作させることもできる。その場合は
  listener内でreply()を呼び、戻り値をpostMessageで戻す、render()を呼び戻り値をpostMessageで返すという処理を行う。


## 1. 会話ログを利用した学習
### userとbotの対話
登場人物がbot自身とuser一人の場合、ユーザの発言がログ中n行目のユーザ発言と類似していればn+1行目のbot発言を返す、という単純な仕組みを考えることができる。
一方で実際にはそれ以外の登場人物も想定される。例えば bot, user, user1の三者で会話していたら、user発言 X に対してbotの返答 Yb またはuser1の返答 Y1 が実行される可能性がある。このログを使った場合、チャットボットは X に対してYbまたはY1を返すことができる。ただしY1は伝聞のていに変換したほうが自然である場合も多いと考えられる。

| speaker | replyer |
|---------|---------|
| user    | bot     |

## 2. 辞書の格納形式
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
type SourceRow= {
  // 検索キー
  botId: string; // チャットボットId
  moduleName: string; // 辞書ソースのファイル名(話題)
  isLearned: 1 | 0;
  
  // 特徴量
  speaker: string; // bot | {botId} | user | user{n} | anon{n} | cue
  speakerId: string; // {botId} | {userId}
  listener: string; // bot | user | many
  listenerId: string; // {botId} | {userId} 
  emotion: string; // アバターの表情
  text: string; // セリフなどの文字列
  date: string;  // "%m/%d" | null
  time: string; // "%H:%M" | null
  numOfSpeakers: string; , // 場にいる人数 1 | 2 | many
  sceneTags: sting; // 天候や部屋の状況 {ECO_SNOWY} | {ECO_START_SNOW} | {ECO_FINE} | ...

};

// メタデータ
type meta = {
  botId: string; // fs上のbotId
  moduleName: string;
  isLearned: 1 | 0;
  updatedAt: datetime; // 更新日時
  hyperParams: {
    speaker: float, speakerId: float:,...
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
### speaker
| speaker | 意味                               |
|---------|------------------------------------|
| bot     | sourceを所有するbot本人            |
| {botId} | 他のbot                            |
| user    | このアプリのユーザ(一人称)         |
| user{n} | 他の実在ユーザ(firestoreIdがある)  |
| anon{n} | 他の不特定ユーザ(firestoreIdなし)  |
| cue     | 入退室や天候の情報                 |



## 2. .dialogファイル定義
originのデータは/content/botModules/{botId}/*.dialogで提供され、
biomebot-transformer-dialogを作成し、graphqlを介してdb.sourceに書き込まれる。
このデータはアプリ起動時に最新版がdb.storeに存在するようsyncを行う。
また.dialog - firestore間でユーザの紐付けはしない（困難）

.dialog形式は人間がシンプルな対話コーパスとして読み書きできることを意図している。

補助構文
* '#'で始まる行はコメント
* withで始まる行に書かれた内容は以降のtext末尾にコピーされる
* "{tag} <word1>,<word2>,..." という形式の行はタグで、対話本体に現れた場合
  word1,word2,... の中からランダムに選んだ一つに置き換えられる。

対話本体
* "<speaker> <text><timestamp>" という形式
* <speaker> が cueの場合、人工環境や入退室など発言以外の情報
* <speaker> が user の場合、対話を行っているユーザ本人の発言。（一人称）
* <speaker> が anon{n} の場合第三者ユーザの発言（三人称）
* <speaker> が 上述以外の行はチャットボットの発言で、<speaker>は表情を表す。
* <timestamp>は`(%m/%d %H:%M)`または`(%m/%d)`または`(%m/%d %H:%M)`という形式で
  発言のあった日付や時刻を書ける。<timestamp>は省略してもよい。
* <text>には `{animal}`などタグを記載できる。
* 空行は話題の切り替わり

例
```
# aulura会話ログ型辞書
{animal} 猫,犬,ペンギン,象,たぬき

user こんにちは！(08:30)
greeting こんにちは。元気ですか？(08:30)
user 元気だよ〜。アウルラさんは元気？
peace 元気です！
peace userさんは最近動物に会いました？
user 猫は見かけたかな・・・
happy 私は{animal}を見ましたよ！
user ・・・え、どどどこで？？！

anon1 こんばんは(12/1 20:32)
user こんばんは！
greeting こんばんは！寒いですね。(12/1 20:32)
cue {ECO_START_SNOW}
chill 雪が降ってきました！
```

### .dialog→db.source変換時の備考
* numOfSpeakersは予めファイルをスキャンして計数したuser,botの人数
* .dialogで行頭に表情タグが現れた場合、db.store上ではspeaker=botとして扱う。
* listenerはspeakerに対応して下記のようにする。listenerは特徴量の一つ
  でuser発言をbotがオウム返しにすることの抑制に効く
|speaker | listener | 
|--------|----------|
| bot    | user     |
| user   | bot      |
| cue    | bot      |
* テキスト内のタグはレンダリングせずタグのまま解析し、返答時に展開する。
  ->cos類似度計算の前に入力文字列のタグ化可能部分をタグにする処理を行う
* with文のスコープは.dialogファイル全体で、次に出現したwithで上書きされる
* 


3. 会話の機序
* bot以外の発言が対話本文のn行に高い類似度を持っていたら次に現れるbot発言行を返答とする。
* 類似度の計算にはdb.sourceの全特徴量を利用し、db.meta.hyperParamsで重み付けする。
  speaker, // one-hot vector
  listener, // one-hot vector 
  emotion, // one-hot vector
  text, // 後述
  date,  // "%m/%d" を一年=2*PIなるラジアン表記の循環特徴量とする
  time, // "%H:%M" を一日=2*PIとなるラジアン表記の循環特徴量とする
  numOfSpeakers, // one-hot vector
  sceneTags, // one-hot vector

### テキストの特徴量化
db.sourceにはもとのテキストがそのまま格納される。
これを元にdb.cacheを生成するときにTF-IDFをベースにした以下の処理を行う。
* {animal} キリン,馬 というタグがあった場合、テキスト中の「キリン」「馬」は{animal}に変換。
* 次にtinysegmenter.jsで分かち書きし、さらに簡易な文節区切りに復元することでノード化。
  (日本語は形態素レベルでは順序に厳しいが、分節区切りでは順序入れ替えに寛容な特性を利用)
* wordVectorは通常one-hot vectorだが、n行目を1, n-1行目を0.6, n-2行目を0.3とした遅延行列
  計算を行うことで緩やかな文脈依存性をもたせる。


4. API
### sync()
* graphqlのデータのほうがdb.meta.gqUodatedAtよりも新しい場合db.sourceにロードする。
* firestoreのデータのほうがdb.meta.fsUpdatedAtよりも古い場合firestoreに転送。
* firestoreのデータのほうがdb.meta.fsUpdatedAtよりも新しい場合db.soureceにロードする。
* ロードが行われた場合db.cacheの再計算を行う

### recieve(message)

```
type message = {
  score: float;
  innerText: string; // 返答の文字列()
  sourceId: int; // 返答のdb.source.id
}
```
{score,db.source.id}を返す。
innerTextはタグを日本語に戻す前の状態のテキスト。

### render(innerText)
他のpartとの競争に勝った場合send()で送ったinnerTextをrenderする。



