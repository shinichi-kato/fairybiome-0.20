EpisodePartクラス
=================

EpisodeStorageを使用して返答を返すパート

## 辞書ファイル

*.episode.json

```json
{
  "description": "挨拶",
  "author":"skato",
  "tags": [
    {
      "surfaces": ["しまりすさん", "シマリスさん"],
      "embedding": {"{you}": 1.0}
    }
  ],
  "factor": {
    "amplitude": 0.6,
    "precision": 0.4,
    "reactivity": 0.7,
    "weight": {
      "role": 0.2,
      "text": 0.3,
      "target": 0.2,
      "date": 0.2,
      "time": 0.1,
      "emo": 0.1,
      "facing": 0.1,
      "location": 0.1,
      "barometer": 0.1,
    }
  },
  "columns": ["role", "text", "target", "date", "time", "emo", "facing", "location"],
  "data": [
    "# 文字列はコメント行かつ話題の区切り",
    ["bot", "こんにちは", "other", "10/12", "12:23", "laugh", "face", "private"],
    ["user", "今日はどう？", "other","10/12", "12:23", "", "face", "private"],
    ["bot", "元気ですよ。{you}は元気？", "other","10/12", "12:25", "happy", "face", "private"],
    ["user", "まあまあ？", "other","10/12", "12:23", "", "face", "private"],
    ["bot", "最近は涼しくなりましたよね。", "other","10/12", "12:25", "happy", "face", "private"],
    null
  ]
}
```

## 返答の機序

### 会話データの特徴量

messageのdataに含まれる特徴量は以下のとおり分類できる。

* 連続的な意味の特徴量:
  * role
  * text
  * target
  * facing
  * location
* 周期的な特徴量:
  * date
  * time
  * emo
* 連続的な値の特徴量
  * barometer

連続的な意味の特徴量とはいわゆるembeddingで、もとはいずれもテキストであるがそれをどのようなwordVectorで表現するかは任意である。これらのうち特徴量だけは先行するいくつかの行のattentionが畳み込まれる。また各特徴量を区別しているのは別個に重み付けするためである。

周期的な特徴量は時刻などで、時刻は述べ秒数としては連続値であるが、今日と昨日の同時刻が文脈的に近いとみなせると便利である。つまり時刻は一日が2π、日付は一年が2π、曜日は一週間で2πとなるラジアン表現が望ましい。これを[sinθ,cosθ]という特徴量に写像することでembedができる。
一方、"emo"は感情である。plutchikの輪など極座標系に見立てて整理した例があり、ラジアン表現にすることで近い感情、対極の感情などを表すことができる。感情はテキストでラベルされているが、それを[sinθ,cosθ]という特徴量に割り当てることでベクトル化し、cos類似度の計算上で周期的な特性を実現する。

連続的な値の特徴量は一般的な数値が特徴量化されたもので大小関係や差が意味を持つ。これは放射規定関数カーネル(RBF)と呼ばれる方法でベクトル化できる。

全ての特徴量について重み付けをした上で一つの行列にまとめて正規化しcos類似度計算を行う。

### 特徴量行列の計算手順

1. `/static/bots/${botName}/${partName}.episode.json`を読み込む
2. 1のファイルのcolumnsに対応した1. `/static/common/feature_${columnName}.embed.json`を読み込む
3. 1のファイルのdataを読み、2が存在する列は2のルールでembedしたvectorをcolumnごとに生成
4. dataのtime列は1日=2PIとなるよう換算したthetaを求め、[sin(theta),con(theta)]を要素としたvectorとする。date列は一年=2PIとなるように換算したthetaを求め、[sin(theta),con(theta)]を要素としたvactorとする。
5. barometer列は最大値が1となるよう規格化した後、放射基底関数カーネルを用いて5要素のベクトル化を行う。
6. dataのtext列の処理は 6.1-6.3 を参照
7. columnごとにベクトルの大きさが1となるよう正規化し、factor.weight.${columnName}で重み付けし、全てのベクトルをconcatして再度ベクトルの大きさが1となるように正規化する。



#### 6.1 word embedding
予めembed表現が決まっている単語をembed表現にマッピングする
1. /static/common/*.embed.jsonを全てthis.wordEmbedsに読み込む（feature_${columnName}.embed.jsonも含む）

#### 6.2 text embedding
1. null行やテキスト行は話題の区切りとみなし、ブロックに分割する。
2. テキストをtinySegmenterで簡易に分かち書きし、要素のリストを逆順にたどる。
3. 要素が格助詞、副助詞、接続助詞と思われるばあいその前の要素を再結合したものについてwordEmbedsに含まれるか調べる。含まれる場合はそのembeddingをwordVectorに加える。
4. 含まれない場合は前の要素と再結合した要素を0.5ずつの重みで特徴量に加える。つまり
```
キメラは → {"キメラ": 0.5, "キメラは": 0.5}
``` 
とする。こうすることで
「私は学校に行く」「学校に私は行く」
のように文節の位置を交換しても意味が同じ文についてwordVectorも同じにできる。また「私立大学」の「私」のように一人称ではない「私」を誤判定する可能性を小さくできる。

5. ブロックごとに `this.wordVector = [[block1],[block2],...]` のように2次元配列として格納する。ここで、separator 行は wordVector に加えない。
6. ブロックごとにdataのindexを`this.indexMap = [[block1],[block2],...]`のように2次元配列として格納する。ここでseparator行はindexMapに加えない。

※5,6 では separator 行を除外する。separator 行は話題の区切りであり、埋め込み対象にはならない。またブロック末尾の行を除外する。ブロック末尾はretrieveで仮にヒットした場合返答になるべきn+1行が存在しないため、検索にヒットさせないため埋め込み対象にしない。

#### 6.3 attention embedding
1. 最新入力を `x_n` として埋め込みを生成する。
2. ブロック内の各行 `x_i` との類似度 `Score(n, i)` を計算する。
3. Softmax で重み `α_i` を生成する。

```text
Score(n, i) = x_n · x_i
α_i = softmax(Score(n,1), ..., Score(n,n-1))
Context_n = Σ_i α_i x_i
```
4. this.wordVectorを平坦化(raval)する。this.indexMapを平坦化する。


### inputに対する返答の手順

以下にはロジックとメッセージングが含まれているが、ロジックは EpisodePart.jsに、メッセージングはEpisodePart.worker.jsにそれぞれ集約する。メッセージングにはboradcastChannel(`biomebot-${botName}`)を使用する。

1. 「特徴量行列の計算手順」の計算キャッシュを利用してmessageを共通の次元でベクトル化。historyに含まれるtextは「特徴量行列の計算手順」と同様の方法で畳み込む。
2. 特徴量行列×messageのcos類似度を計算
3. cos類似度のがfactor.precisionよりも大きい上位3行を選び(A)とする。一つもなかったら[]を返す。
4. からランダムに一つを選び、その「次の行」をmessage化して返答とし、scoreをscore*factor.amplitudeとする。
5. 4のmessage.targetがselfだった場合、出力messageを入力として1-4を実行し、もう一つの出力messaegeとする。
6. historyにinputのmessageを追加する。
7. 出力messageのリストを返す。

### 他のパートが送信したinnerSpeechへの返答

以下にはロジックとメッセージングが含まれているが、ロジックは EpisodePart.jsに、メッセージングはEpisodePart.worker.jsにそれぞれ集約する。メッセージングにはboradcastChannel(`biomebot-${botName}`)を使用する。

1. 1-0の乱数を生成し、それがfactor.reactivityより小さかったら以下を実行する。
2. 「特徴量行列の計算手順」の計算キャッシュを利用してmessageを共通の次元でベクトル化
3. 特徴量行列×messageのcos類似度を計算
4. cos類似度のがfactor.precisionよりも大きい上位3行を選び(A)とする。一つもなかったら終了。
5. からランダムに一つを選び、その「次の行」をmessage化して返答としてinnerSpeechとして配信する。

### outputを受信したときの対応

メッセージングにはboradcastChannel(`biomebot-${botName}`)を使用する。

orchestratorというpartがinnerSpeechを統合してoutputを送信してくる。このoutputを受信したらhistoryにoutputのmessageを追加する。

## partの管理
workerのpostMessage/onmessageを使用し、kernelとの間でactivate/deactivate/report/terminateを行う。
