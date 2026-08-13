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
    "retention": 0.7
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
  - role
  - text
  - target
  - facing
  - location
* 周期的な特徴量: 
  - date
  - time
  - emo 
* 連続的な値の特徴量
  - barometer

連続的な意味の特徴量とはいわゆるembeddingで、もとはいずれもテキストであるがそれをどのようなwordVectorで表現するかは任意である。これらのうち特徴量だけは先行するいくつかの行のattentionが畳み込まれる。また各特徴量を区別しているのは別個に重み付けするためである。

周期的な特徴量は時刻などで、時刻は述べ秒数としては連続値であるが、今日と昨日の同時刻が文脈的に近いとみなせると便利である。つまり時刻は一日が2π、日付は一年が2π、曜日は一週間で2πとなるラジアン表現が望ましい。なお"emo"は感情である。感情はplutchikの輪など極座標系に見立てて整理した例があり、ラジアン表現にすることで近い感情、対極の感情などを表すことができる。

畳み込みや重み付けをした上で連続的な意味の特徴量と周期的な特徴量は一つの行列にまとめて処理する。

連続的な値の特徴量は一般的な数値が特徴量化されたもので大小関係や差が意味を持つ。

### 計算法

1. 特徴量行列は行ごとに正規化し、内積計算によってcos類似度とする。
2. cos類似度の値ののうちfacor.precisionよりも大きい上位3行を選び、その中からランダムに一行を選ぶ。その行の次の行を返答とする。
3. 2.で選んだスコアを(A)とする。(A)*factor.amplitudeをスコアとしてinnerSpeechを送信する。

### inputに対する返答
1. inputを受け取ったらmessageをwordVector化し、上述の計算法で
   innerSpeechを送信する。
2. 1のtargetがselfだった場合、出力messageをもう一度1.を実行する。

### 他のパートが送信したinnerSpeechへの返答
innerSpeechを受け取ったら