EpisodeTrackerPart Class
=======================

EpisodeTrackerPart は、予め用意したログやユーザとの会話ログから類似した発話を検索し、その次の行を返答候補として返すパート。実装部分はEpisodeStorage.jsにほとんど記述され、
EpisodeTrackerPartはそれをworker化するラッパーである。

## onmessage

### {type: "deploy", botName: string, partName:string}
episodeStorage.deploy(botName,partName)を実行

### {type: "receive", message: object}
- 受信メッセージを解析し、類似度計算を行い、返答を選択する。
- 自分自身の別パートが発したメッセージも受信する（内言）
- 天気や日の出・日没などのメッセージも受信する。(role="eco")

入力メッセージ形式:
```json
{
  "role": "user" | "bot" | "eco",
  "id": "string",
  "text": "string",
  "time"?: [hour:int, minute:int],
  "date"?: [month:int, day:int],
  "emo"?: "string",
  "facing"?: 0 | 3.141592653589793,
  "pressure"?: 0.0..1.0,
  "location"?: "string"
}
```

出力は channelへのメッセージ送出で行う。
送出メッセージ:
```json
{
  "partName": string,
  "score": number,
  "message": {<入力メッセージ>  },
  "error": string
}
```
#### 形式の詳細
- `time`: `[hour, minute]`。
- `date`: `[month, day]`。
- `facing`: 0 または π の数値。
- `pressure`: 0.0〜1.0 の連続値。
- `location`: 既知カテゴリなら one-hot、未知は `unknown` で扱う。
- `emo`: 喜び=0,信頼=1/4π,恐れ=1/2π,驚き=3/4π,悲しみ=π,嫌悪=5/4π,怒り=3/2π,期待=7/4π

### report()
- パートの稼働状況を返す。
- 例:
```json
{
  "deployedAt": "ISO timestamp",
  "lastRepliedAt": "ISO timestamp"
}
```

### terminate()
- インスタンスの状態を破棄し、必要なら関連メモリやリソースを解放する。
- Dexie のキャッシュは通常破壊せず、再 `deploy()` が可能な状態を残す仕様とする。

## 特徴量設計

ログは複数のインスタンス（＝行）から構成され、各インスタンスは複数の特徴量を持ちます。

| 特徴量 | 形式 | 説明 |
|---|---|---|
| roleOnehot | one-hot | `user` / `bot` を示す |
| idEmbed | ベクトル | user / bot の識別子を埋め込む |
| textEmbed | ベクトル | テキスト埋め込み |
| timeCyc | [sin, cos] | 1 日を 2π とした時間の周期表現 |
| dateCyc | [sin, cos] | 1 年を 2π とした日付の周期表現 |
| emoCyc | [sin, cos] | Plutchik の輪に基づく感情表現 |
| facingCyc | [sin, cos] | 0=向き合う、π=背を向ける |
| pressureNorm | [sqrt(p), sqrt(1-p)] | 気圧・天候を正規化 |
| locationOnehot | one-hot | 'private' / 'public' |

- emoは喜び=0,信頼=1/4π,恐れ=1/2π,驚き=3/4π,悲しみ=π,嫌悪=5/4π,怒り=3/2π,期待=7/4πとし、それらの[sin,cos]を特徴量とする

### 欠損値の扱い
- `columns` に含まれない項目は欠損とみなし、該当特徴量をゼロベクトルで表現する。
- 欠損値が多い場合、類似度計算のバイアスに注意する。

## 類似度計算

### 特徴量ベクトルの結合
- 各特徴量を部分ベクトルに変換し、1 つの長いベクトル `x` に結合する。
- `x_1 · x_2` は同じベクトル空間上の内積として計算する。

### 重み付き類似度

```text
score(x_1, x_2) = Σ_i k_i ⟨x_{1,i}, x_{2,i}⟩
```

- `x_{*,i}` は特徴量 `i` の部分ベクトル。
- `k_i` は特徴量ごとの重み。
- まずは `textEmbed` を主軸にし、他の特徴量は補助として用いる。
- `k_i` は固定値でも構わないが、ログが増えたときに再調整できるようにする。

## テキストに対する前処理
- テキストのなかでタグ辞書this.WordTagsにヒットしたものは予めタグ化する。

## Attention 方式の文脈追跡



1. 最新入力を `x_n` として埋め込みを生成する。
2. 過去の各行 `x_i` との類似度 `Score(n, i)` を計算する。
3. Softmax で重み `α_i` を生成する。
4. `Context_n = Σ_i α_i x_i` を計算する。
5. `x_n` と `Context_n` を結合または足し合わせ、文脈付きベクトルを生成する。

式:

```text
Score(n, i) = x_n · x_i
α_i = softmax(Score(n,1), ..., Score(n,n-1))
Context_n = Σ_i α_i x_i
```

- `Context_n` は返答候補の絞り込みや再スコアリングに使用する。

## 返答候補の選択

- 現在入力と類似度計算を行い、発言のうちスコアが大きいtop4を選び、その中からランダムに一つを選ぶ。roleの重みを大きくすることでroleに従った検索が行われる。
- その行に続く `bot` 発言を返答候補とする。
- 類似度がしきい値precision以下の場合は候補が存在しないとみなし、errorとして"not_found"を返す。

なお、候補が見つからなかった場合専用のパート(precisionが0)を別途用意してフォールバックとする。

## EpisodeTrackerのデータ形式

チャットログのデータを以下の形式で記録する。
columnsの内容はEpisodeTrackerの特徴量で、適宜省略可能である。
```json
{
  "title": "挨拶",
  "author":"skato",
  "tags": [],
  "factor": {
    "activity": 0.6,
    "precision": 0.4
  },
  "columns": ["role", "text", "date", "time", "emo", "facing", "location"],
  "data": [
    "# 文字列はコメント行かつ話題の区切り",
    ["bot", "こんにちは", "10/12", "12:23", "laugh", 0, "indoor"],
    ["user", "今日はどう？", "10/12", "12:24", "", 0, "indoor"],
    null,
    ["bot", "元気ですよ。", "10/12", "12:25", "happy", 0, "indoor"]
  ]
}
```
話題の区切りは data 配列内の `null` 行でも指定できます。

## データストレージ方針

- 事前定義ログは `static/chatbots/{name}/{partName}.json` で供給する。
- ユーザ学習データは Firestore の `chatbots/{name}/{partName}.json` に保存する。
- Dexie はブラウザ内キャッシュとして前処理済み特徴量行列や検索インデックスを保持する。
- Firestore / static / Dexie の同期ルールを明確にし、キャッシュの再構築方法を定義する。

## 注意点

- `receiveAndReply` が `user` 発言のみを対象にするのか、`bot` 発言も含めるのかを明確にする。
- `idEmbed` の具体的な埋め込み方法を決める。
- `k_i` の重み付けは最初は固定値で運用し、後から再調整できるようにする。
- `Context_n` を返答選択に活かすフローを実装仕様として固める。