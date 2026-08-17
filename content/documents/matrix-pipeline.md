# 特徴量行列の計算パイプライン

この文書は、「特徴量行列の計算手順」全体を統合したパイプラインの説明です。特徴量の各種タイプ、埋め込み方法、および最終的な行列生成プロセスを段階的に解説します。

---

## パイプラインの全体図

```
┌─────────────────────────────────────────────────────────────────┐
│ EpisodeStorage.build() インエントリーポイント                    │
└─────────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│ Step 1: データファイルの読み込み                                 │
│  - /static/bots/${botName}/${partName}.episode.json             │
│  - columns, data, factor を抽出                                 │
└─────────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│ Step 2: Word Tags ファイルの読み込み                             │
│  - /static/common/feature_${columnName}.embed.json              │
│  - /static/common/*.embed.json                                  │
│  - addWordTags() で辞書を構築                                    │
└─────────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│ Step 3: 各行のベクトル化（Feature Extraction）                  │
│  - row ごとに特徴量を計算                                        │
│  - 連続的意味 → word embedding                                  │
│  - 周期的 → [sin, cos] / emotion embedding                      │
│  - 連続値 → RBF kernel                                          │
│  - text → text embedding + attention                           │
└─────────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│ Step 4: 正規化・重み付け・連結                                   │
│  - 各特徴量ベクトルを L2 正規化                                   │
│  - factor.weight で重み付け                                     │
│  - 全ベクトルを concatenate                                      │
│  - 最終ベクトルを再正規化                                         │
└─────────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│ Step 5: 行列の形成・キャッシュ                                   │
│  - すべての行ベクトルを行列 M に統合                             │
│  - Dexie DB に保存（キャッシュ）                                 │
└─────────────────────────────────────────────────────────────────┘
                           ↓
                    準備完了: retrieve() で使用可能
```

---

## Step 1: データファイルの読み込み

### ファイル形式

```json
{
  "description": "パートの説明",
  "author": "作成者",
  "tags": [
    {
      "surfaces": ["keyword1", "keyword2"],
      "embedding": { "concept": 1.0 }
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
      "barometer": 0.1
    }
  },
  "columns": ["role", "text", "target", "date", "time", "emo", "facing", "location"],
  "data": [
    "# トピック1",
    ["bot", "こんにちは", "other", "10/12", "12:23", "laugh", "face", "private"],
    ["user", "元気？", "other", "10/12", "12:23", "", "face", "private"],
    null,
    "# トピック2",
    ["bot", "はい！", "self", "10/12", "12:25", "happy", "face", "private"]
  ]
}
```

### 抽出項目
- `columns`: 各行のスキーマ定義
- `data`: 会話データの配列
- `factor`: 検索・生成パラメータ（amplitude, precision, reactivity, weight）

---

## Step 2: Word Tags ファイルの読み込み

### 対象ファイル

```
/static/common/*.embed.json
/static/common/feature_${columnName}.embed.json
/static/bots/${botName}/tags/*.json
```

### 処理

```javascript
// deploy() メソッド内
await this.readWordTags('/static/common/general.embed.json');
await this.readWordTags('/static/common/feature_text.embed.json');
// ... 他のタグファイル
```

### 結果

`this.WordTags.dict` に辞書が構築される：
```javascript
WordTags.dict = {
  "兄": { index: 0, embedding: {...}, groupId: 0 },
  "お兄さん": { index: 1, embedding: {...}, groupId: 0 },
  // ...
};
```

詳細: [word-embedding.md](word-embedding.md)

---

## Step 3: 各行のベクトル化

### 3.1 Column ごとの特徴量抽出

data の各行に対して、columns の順序に従ってベクトル化を実行：

```javascript
// 行の例
row = ["bot", "こんにちは", "other", "10/12", "12:23", "laugh", "face", "private"]

// columns の例
columns = ["role", "text", "target", "date", "time", "emo", "facing", "location"]

// ベクトル化
{
  "role": vec_role,      // word embedding
  "text": vec_text,      // text embedding + attention
  "target": vec_target,  // word embedding
  "date": vec_date,      // [sin, cos] ベクトル
  "time": vec_time,      // [sin, cos] ベクトル
  "emo": vec_emo,        // emotion embedding
  "facing": vec_facing,  // word embedding
  "location": vec_location  // word embedding
}
```

### 3.2 各特徴量の計算方法

#### A. 連続的な意味の特徴量（role, target, facing, location）

```javascript
// word embedding で変換
// WordTags.dict を検索

// "other" の場合
embedding_other = WordTags.dict["other"]?.embedding;
// → { "相手": 1.0, "他人": 0.3 } のような embedding オブジェクト
```

詳細: [word-embedding.md](word-embedding.md)

#### B. Text 列の処理

```javascript
// 特殊な処理: テキスト分かち書き + 複合語マッピング + Attention

text = "こんにちは"
vec_text = TextEmbedding.process(text, this.WordTags.dict)
```

詳細: [text-embedding.md](text-embedding.md), [attention-embedding.md](attention-embedding.md)

#### C. 周期的な特徴量（date, time, emo）

##### Date（日付）の処理

```javascript
// 入力: "10/12"
// 1年 = 2π として換算

month = 10;
day = 12;
dayOfYear = (month - 1) * 30 + day;  // 概算
theta_date = (dayOfYear / 365) * 2 * Math.PI;

vec_date = [Math.sin(theta_date), Math.cos(theta_date)];
// → [sin, cos] の 2 次元ベクトル
```

##### Time（時刻）の処理

```javascript
// 入力: "12:23"
// 1日 = 2π として換算

hours = 12;
minutes = 23;
seconds = hours * 3600 + minutes * 60;
theta_time = (seconds / 86400) * 2 * Math.PI;

vec_time = [Math.sin(theta_time), Math.cos(theta_time)];
// → [sin, cos] の 2 次元ベクトル
```

##### Emotion（感情）の処理

```javascript
// 入力: "laugh"（笑い）、"happy"（幸せ）など
// Plutchik の感情の輪でマッピング

emotionToAngle = {
  "joy": 0,
  "trust": Math.PI / 4,
  "fear": Math.PI / 2,
  "surprise": 3 * Math.PI / 4,
  "sadness": Math.PI,
  "disgust": 5 * Math.PI / 4,
  "anger": 3 * Math.PI / 2,
  "anticipation": 7 * Math.PI / 4,
  "happy": 0,         // joy の同義語
  "laugh": 0,         // joy の同義語
};

theta_emo = emotionToAngle[emotion] || 0;
vec_emo = [Math.sin(theta_emo), Math.cos(theta_emo)];
```

詳細: [feature-types.md](feature-types.md)

#### D. 連続的な値の特徴量（barometer）

```javascript
// 入力: 気圧など（例: 1013.25）

// 1. 最大値を 1 に規格化（既知範囲があると仮定）
barometer_normalized = barometer / barometer_max;  // [0, 1] に正規化

// 2. RBF カーネルでベクトル化
// センター点: [0, 0.25, 0.5, 0.75, 1.0]
centers = [0, 0.25, 0.5, 0.75, 1.0];
gamma = 1.0;  // 幅パラメータ

vec_barometer = centers.map(c => 
  Math.exp(-gamma * (barometer_normalized - c) ** 2)
);
// → 5 次元のベクトル
```

詳細: [feature-types.md](feature-types.md)

---

## Step 4: 正規化・重み付け・連結

### 4.1 各ベクトルの L2 正規化

```javascript
function normalize(vec) {
  const norm = Math.sqrt(vec.reduce((s, v) => s + v*v, 0));
  return vec.map(v => v / norm);
}

// 例
vec_role_norm = normalize(vec_role);
vec_text_norm = normalize(vec_text);
// ...
```

### 4.2 重み付け

```javascript
// factor.weight から取得
const weights = factor.weight;  // { role: 0.2, text: 0.3, ... }

vec_role_weighted = vec_role_norm.map(v => v * weights.role);
vec_text_weighted = vec_text_norm.map(v => v * weights.text);
// ...
```

### 4.3 連結（Concatenation）

```javascript
const allWeightedVecs = [
  vec_role_weighted,      // 長さ 可変 (word embedding)
  vec_text_weighted,      // 長さ: 単語数による可変
  vec_target_weighted,    // 長さ 可変 (word embedding)
  vec_date_weighted,      // 長さ 2
  vec_time_weighted,      // 長さ 2
  vec_emo_weighted,       // 長さ 2
  vec_facing_weighted,    // 長さ 可変 (word embedding)
  vec_location_weighted   // 長さ 可変 (word embedding)
];

const concatenated = allWeightedVecs.flat();
// 総長: ~ 12 次元以上（text の複雑さに依存）
```

### 4.4 最終正規化

```javascript
const finalVector = normalize(concatenated);
// → 大きさ 1 のベクトル

// 結果の形式
finalVector = [v1, v2, v3, ..., vN] where |finalVector| = 1
```

---

## Step 5: 行列の形成とキャッシュ

### 行列の構造

```javascript
// 全行のベクトルを行列 M に統合
//       col1  col2  col3  ... colN
M = [
  [v1_1, v1_2, v1_3, ..., v1_N],  // 行 1
  [v2_1, v2_2, v2_3, ..., v2_N],  // 行 2
  [v3_1, v3_2, v3_3, ..., v3_N],  // 行 3
  // ...
  [vM_1, vM_2, vM_3, ..., vM_N]   // 行 M
]

// 各行のノルムは 1（正規化済み）
```

### キャッシュ保存

```javascript
// Dexie DB に保存
const cacheEntry = {
  botName: botName,
  partName: partName,
  timestamp: new Date().toISOString(),
  vocab: [...すべての単語],
  matrix: M
};

await db.caches.put(cacheEntry);
```

**目的:**
- 再構築時間の短縮
- 同じデータに対する重複計算を回避

---

## 全体の疑似コード

```javascript
async build(botName, partName) {
  // Step 1: データロード
  const data = await this.readStatic(botName, partName);
  const { columns, data: rows, factor } = data;

  // Step 2: Word Tags ロード
  await this._loadStaticTagFiles();

  // Step 3: 各行をベクトル化
  const vectors = [];
  for (const row of rows) {
    if (typeof row === 'string' || row === null) continue; // separator スキップ

    const vector = {};
    for (let i = 0; i < columns.length; i++) {
      const colName = columns[i];
      const value = row[i];

      switch (colName) {
        case 'text':
          vector[colName] = this.embedText(value);
          break;
        case 'date':
        case 'time':
          vector[colName] = this.embedPeriodic(value, colName);
          break;
        case 'emo':
          vector[colName] = this.embedEmotion(value);
          break;
        case 'barometer':
          vector[colName] = this.embedContinuous(value);
          break;
        default:
          vector[colName] = this.embedMeaning(value, colName);
      }
    }
    vectors.push(vector);
  }

  // Step 4: 正規化・重み付け・連結
  const matrix = [];
  for (const vector of vectors) {
    const weighted = {};
    for (const col of columns) {
      const vec = vector[col];
      const norm = normalize(vec);
      weighted[col] = norm.map(v => v * factor.weight[col]);
    }
    const final = normalize(flatten(Object.values(weighted)));
    matrix.push(final);
  }

  // Step 5: キャッシュ保存
  await this._cacheMatrix(botName, partName, matrix);

  return true;
}
```

---

## パフォーマンス考慮事項

### 計算量
- **Step 3**: $O(M \times N)$ — M: 行数、N: 列数
- **Step 4**: $O(M \times D)$ — D: ベクトル次元
- **全体**: $O(M \times (N + D))$

### キャッシング戦略
- タイムスタンプ比較で再構築判定
- 同一データなら Dexie から復旧

### メモリ使用量
- 各行ベクトル: ~100-1000 bytes
- M 行の場合: 数 MB ~ 数十 MB（通常許容範囲）

---

## 参照

- 特徴量の分類: [feature-types.md](feature-types.md)
- Word Embedding: [word-embedding.md](word-embedding.md)
- Text Embedding: [text-embedding.md](text-embedding.md)
- Attention Embedding: [attention-embedding.md](attention-embedding.md)
- 返答ロジック: [retrieval-logic.md](retrieval-logic.md)
