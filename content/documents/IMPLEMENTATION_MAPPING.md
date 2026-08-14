# EpisodeStorage.js メソッド責任マッピング

EpisodeStorage.js の 41 個のメソッドを、提案する 6 つの新規モジュール + EpisodeStorage（簡略化）に分類したドキュメントです。

---

## 1. モジュール別メソッドマッピング

### WordEmbedding.js

**責務**: Word Tag 辞書の管理、embedding の正規化、Surface → embedding のマッピング

**現在の EpisodeStorage.js メソッド:**
- `addWordTags(data, source)` — タグデータの追加と辞書構築
- `_normalizeEmbedding(embedding)` — embedding の値の合計を 1 に正規化
- `_buildWordTagSubstitutionMap(text)` — テキスト内の word tag マッチを検出
- `_rewriteTextWithMatchedTags(text, substitutions)` — マッチしたタグでテキスト置換

**新モジュールの責務:**
```javascript
class WordEmbedding {
  constructor() {
    this.dict = {};        // surface → { index, embedding, groupId }
    this.groups = {};      // groupId → { surfaces }
    this.nextGroupId = 0;
  }

  addWordTags(data, source) { ... }
  normalizeEmbedding(embedding) { ... }
  getEmbedding(surface) { ... }      // 辞書検索
  hasEmbedding(surface) { ... }      // 存在確認
}
```

---

### DataLoader.js

**責務**: ファイル読み込み（JSON ファイル）、ソースデータ管理

**現在の EpisodeStorage.js メソッド:**
- `readWordTags(path)` — fetch して JSON 読み込み、addWordTags へ委譲
- `readStatic(botName, partName)` — *.episode.json 読み込み
- `_loadStaticTagFiles()` — 環境変数で定義されたタグファイル一括ロード
- `_getSourceTimestamp()` — data タイムスタンプ取得
- `validateData(data)` — JSON スキーマ検証（最後に記載）

**新モジュールの責備:**
```javascript
class DataLoader {
  constructor() {
    this.staticSource = null;
    this.firestoreSource = null;
  }

  async readWordTags(path) { ... }
  async readStatic(botName, partName) { ... }
  async loadStaticTagFiles() { ... }
  async loadEmotionEmbeddings(path) { ... }  // NEW: feature_emo.embed.json 読み込み
  getSourceTimestamp() { ... }
  
  static validateData(data) { ... }
}
```

**新メソッド詳細:**
- `loadEmotionEmbeddings(path)` — `/static/common/feature_emo.embed.json` を fetch・JSON parse
  - FeatureExtractor のコンストラクタに渡され、感情マッピングを動的に構築
  - 失敗時は `null` を返す（デフォルト感情マップを使用）

---

### TextEmbedding.js

**責務**: テキスト分かち書き、複合語マッピング、テキスト → embedding 変換

**現在の EpisodeStorage.js メソッド:**
- `_embedText(text)` — テキストを embedding オブジェクトに変換
- `_segmentText(text)` — TinySegmenter で分かち書き
- `_isParticle(token)` — 助詞判定
- `_isPunctuation(token)` — 句読点判定
- `_addTokenWeight(features, token, weight)` — トークンの重み付け加算
- `_addEmbeddingToFeatures(features, embedding, weight)` — embedding を features に加算

**新モジュールの責務:**
```javascript
class TextEmbedding {
  constructor(wordEmbedding, segmenter) {
    this.wordEmbedding = wordEmbedding;  // 依存: WordEmbedding インスタンス
    this.segmenter = segmenter;           // TinySegmenter
  }

  embedText(text) { ... }
  segmentText(text) { ... }
  private isParticle(token) { ... }
  private isPunctuation(token) { ... }
}
```

**依存関係**: WordEmbedding（辞書検索に必要）

---

### FeatureExtractor.js

**責務**: 各特徴量タイプの単位ベクトル化（date, time, emo, barometer など）

**現在の EpisodeStorage.js メソッド:**
- 現在は明示的なメソッドなし（build() 内にインライン）
- 周期的特徴量の計算ロジック
- RBF カーネル計算

**新モジュールの責務:**
```javascript
class FeatureExtractor {
  constructor(emotionEmbeddings = null) {
    // emotionEmbeddings: /static/common/feature_emo.embed.json から読み込んだ配列
    // _buildEmotionToAngle() で動的に感情マッピングを構築
  }

  extractDate(dateStr) { ... }           // "10/12" → [sin, cos]
  extractTime(timeStr) { ... }           // "12:23" → [sin, cos]
  extractEmotion(emotionStr) { ... }     // "happy"/"喜び" → [sin, cos]
  extractContinuous(value, max) { ... }  // barometer → RBF vector
  
  private _buildEmotionToAngle(emotionEmbeddings) { ... }
  private rbfKernel(x, center, gamma) { ... }
}
```

**実装の利点:**
- 感情マッピングが JSON（`/static/common/feature_emo.embed.json`）から動的に読み込まれる
- ユーザー利便性：複数の表記（英語エイリアス、日本語同義語）に対応
- 計算の軽量化：embedding が直接 sin/cos に変換されている
- 拡張性：感情の分割方法を変更する場合、JSON ファイルのみ修正で対応可能

**パラメータ詳細:**
```javascript
// feature_emo.embed.json の構造例
[
  {
    "surfaces": ["joy", "喜び", "嬉しい"],
    "embeddings": {"{emo_joy_sin}": 0, "{emo_joy_cos}": 1.0}
  },
  {
    "surfaces": ["anger", "怒り"],
    "embedding": {"{emo_anger_sin}": -1.0, "{emo_anger_cos}": 0}
  }
]
```

**特徴**: ロジックなし、純粋な計算のみ（テスト可能）

---

### AttentionEmbedding.js

**責務**: Attention 機構（Softmax ベースの重み付け）、ベクトル操作

**現在の EpisodeStorage.js メソッド:**
- `_buildAttentionVectors(wordVector)` — 全ブロック × Attention 計算
- `_vectorDot(a, b)` — ベクトルの内積（スコア計算）
- `_softmax(scores)` — softmax 関数（重み化）
- `_addVector(base, vector, scale)` — ベクトル加算（重み付き）

**新モジュールの責務:**
```javascript
class AttentionEmbedding {
  buildAttentionVectors(wordVector) { ... }
  
  private computeContextForBlock(block) { ... }
  private vectorDot(a, b) { ... }
  private softmax(scores) { ... }
  private addVector(base, vector, scale) { ... }
}
```

**特徴**: ベクトル演算の低レベルAPI

---

### MatrixBuilder.js

**責務**: 全体のパイプライン調整、特徴量行列の構築

**現在の EpisodeStorage.js メソッド:**
- `build(botName, partName)` — メインビルダー（オーケストレーション）
- `_collectDataRows()` — data から separator を除いて行リストを生成
- `_buildWordVectorBlocks(dataRows)` — ブロック分割と word vector 生成
- `_embedBlock(lines)` — ブロック内の embedding 計算
- `_buildCacheMeta(wordVector)` — vocab と matrix をキャッシュ形式に整形

**新モジュールの責務:**
```javascript
class MatrixBuilder {
  constructor(
    dataLoader,
    wordEmbedding,
    textEmbedding,
    featureExtractor,
    attentionEmbedding
  ) {
    // 依存性注入
  }

  async build(botName, partName) { ... }
  
  private collectDataRows() { ... }
  private buildWordVectorBlocks(dataRows) { ... }
  private embedBlock(lines) { ... }
  private buildCacheMeta(wordVector) { ... }
}
```

**依存関係**: DataLoader, WordEmbedding, TextEmbedding, FeatureExtractor, AttentionEmbedding

---

### Retriever.js

**責務**: 類似度計算、検索、スコアリング

**現在の EpisodeStorage.js メソッド:**
- `retrieve(message, verbose)` — メイン検索ロジック
- `_getTextIndex()` — テキスト列のインデックス取得
- `_getPrecisionThreshold()` — factor.precision から threshold 取得
- `_hasNextDataRow(rowIndex)` — 次行存在確認
- `_getNextDataRow(rowIndex)` — 次行データ取得

**新モジュールの責務:**
```javascript
class Retriever {
  constructor(
    matrix,       // 特徴量行列
    dataRows,     // 元データ行のリスト
    factor,       // { precision, amplitude, ... }
    wordEmbedding // 検索テキストのベクトル化用
  ) {}

  retrieve(message, verbose = false) { ... }
  
  private getTextIndex() { ... }
  private getPrecisionThreshold() { ... }
  private hasNextDataRow(rowIndex) { ... }
  private getNextDataRow(rowIndex) { ... }
}
```

**特徴**: Retriever は matrix を「参照のみ」（読み込み専用）

---

### EpisodeStorage.js（簡略化）

**責務**: DB 管理（Dexie）、モジュール間調整、Public API

**残存メソッド:**
- `constructor()` — Dexie DB 初期化
- `deploy(botName, partName, data)` — 簡略化版（MatrixBuilder へ委譲）
- `deployFromJson(botName, partName)` — JSON デプロイ
- `retrieve(message)` — Retriever へ委譲
- `_loadCache(botName, partName)` — DB 読み込み
- `_saveCache(cacheEntry)` — DB 書き込み
- `_isCacheFresh(cacheTs, sourceTs)` — タイムスタンプ比較

**新しい責務:**
```javascript
export class EpisodeStorage {
  constructor(firestore_token) {
    this._db = new Dexie("EpisodeStorage");
    // ... DB スキーマ定義
    
    // モジュール初期化
    this.dataLoader = new DataLoader();
    this.wordEmbedding = new WordEmbedding();
    this.textEmbedding = new TextEmbedding(this.wordEmbedding, segmenter);
    this.featureExtractor = new FeatureExtractor();
    this.attentionEmbedding = new AttentionEmbedding();
    this.matrixBuilder = new MatrixBuilder(...);
    this.retriever = null;  // build() 後に初期化
  }

  async deploy(botName, partName, data) {
    // matrixBuilder.build() 呼び出し
    // retriever インスタンス生成
  }

  retrieve(message) {
    // retriever.retrieve() に委譲
  }

  private async loadCache(botName, partName) { ... }
  private async saveCache(cacheEntry) { ... }
  private isCacheFresh(cacheTs, sourceTs) { ... }
}
```

---

## 2. 依存グラフ

```
┌────────────────┐
│  DataLoader    │
└────────┬───────┘
         │ load JSON
         ↓
┌─────────────────────────┐
│  EpisodeStorage         │
│ (DB, Orchestrator)      │
└────────┬────────────────┘
         │
         ├─→ WordEmbedding (tag dict)
         │        │
         │        └─→ TextEmbedding
         │              │
         ├─→ FeatureExtractor
         │
         ├─→ MatrixBuilder
         │        │
         │        ├─→ TextEmbedding
         │        ├─→ FeatureExtractor
         │        └─→ AttentionEmbedding
         │
         └─→ Retriever
               │
               ├─ matrix (MatrixBuilder 出力)
               └─ WordEmbedding (検索時の embed)
```

---

## 3. データフロー

### Build フロー

```
DataLoader.readStatic()
    ↓ (*.episode.json)
EpisodeStorage.deploy()
    ↓
MatrixBuilder.build()
    ├─ DataLoader.readWordTags()
    │       ↓
    │  WordEmbedding.addWordTags()
    │
    ├─ MatrixBuilder.collectDataRows()
    │
    ├─ MatrixBuilder.buildWordVectorBlocks()
    │       ├─ TextEmbedding.embedText()
    │       │     ├─ TinySegmenter.segment()
    │       │     └─ WordEmbedding.getEmbedding()
    │       │
    │       └─ FeatureExtractor.extract{Date,Time,Emo,Continuous}()
    │
    ├─ AttentionEmbedding.buildAttentionVectors()
    │
    └─ EpisodeStorage._saveCache()
           ↓ (Dexie)
```

### Retrieve フロー

```
message (input)
    ↓
Retriever.retrieve()
    ├─ TextEmbedding.embedText(message.text)
    ├─ FeatureExtractor.extract{Date,Time,...}(message)
    ├─ cos 類似度計算 (matrix との内積)
    ├─ 上位 N 行フィルタリング
    │   (factor.precision)
    │
    └─ 返答生成
        └─ Retriever.getNextDataRow()
```

---

## 4. メソッド総数確認

### 移動前（EpisodeStorage.js）
- Public: 6 個（deploy, deployFromJson, readWordTags, readStatic, build, retrieve）
- Private: 35 個

### 移動後の分布

| モジュール | メソッド数 | 説明 |
|----------|----------|------|
| WordEmbedding | 4 | tag 管理・正規化 |
| DataLoader | 5 | ファイル読み込み・検証 |
| TextEmbedding | 6 | 分かち書き・複合語 |
| FeatureExtractor | 6 | 各特徴量計算 |
| AttentionEmbedding | 4 | Attention + ベクトル演算 |
| MatrixBuilder | 5 | パイプライン全体 |
| Retriever | 5 | 検索・スコアリング |
| EpisodeStorage | 8 | DB + orchestration |
| **合計** | **43** | 新規 API 2 個 include |

---

## 5. インターフェース定義

### WordEmbedding

```typescript
class WordEmbedding {
  addWordTags(data: object[], source?: string): void
  normalizeEmbedding(embedding: object): object | null
  getEmbedding(surface: string): {index, embedding, groupId} | undefined
  hasEmbedding(surface: string): boolean
}
```

### DataLoader

```typescript
class DataLoader {
  async readWordTags(path: string): Promise<void>
  async readStatic(botName: string, partName: string): Promise<object>
  async loadStaticTagFiles(): Promise<void>
  getSourceTimestamp(): number
  static validateData(data: object): 'ok' | string
}
```

### TextEmbedding

```typescript
class TextEmbedding {
  embedText(text: string): object  // {key: weight, ...}
  segmentText(text: string): string[]
}
```

### FeatureExtractor

```typescript
class FeatureExtractor {
  extractDate(dateStr: string): number[]      // [sin, cos]
  extractTime(timeStr: string): number[]      // [sin, cos]
  extractEmotion(emotionStr: string): number[]
  extractContinuous(value: number, max: number): number[]  // RBF
}
```

### AttentionEmbedding

```typescript
class AttentionEmbedding {
  buildAttentionVectors(wordVector: object[][][]): object[][][]
}
```

### MatrixBuilder

```typescript
class MatrixBuilder {
  async build(botName: string, partName: string): Promise<boolean>
  // 内部で matrix, indexMap, attentionVectors を構築
}
```

### Retriever

```typescript
class Retriever {
  retrieve(message: Message, verbose?: boolean): {
    status: 'ok' | 'error',
    row?: any[],
    score?: number,
    ...
  }
}
```

---

## 6. 実装順序

1. **FeatureExtractor** — 最も単純（ロジックのみ）
2. **WordEmbedding** — tag 管理の基盤
3. **TextEmbedding** — WordEmbedding に依存
4. **DataLoader** — ファイル操作（独立）
5. **AttentionEmbedding** — ベクトル演算（独立）
6. **MatrixBuilder** — 全て を統合
7. **Retriever** — matrix 完成後
8. **EpisodeStorage** — 最後に refactor

---

## 7. テスト戦略

### ユニットテスト

- **WordEmbedding**: 辞書構築、embedding 正規化
- **TextEmbedding**: TinySegmenter 出力、複合語マッピング
- **FeatureExtractor**: 周期的特徴量の計算値検証
- **AttentionEmbedding**: softmax, 内積の数値検証
- **MatrixBuilder**: パイプライン全体（モック使用）
- **Retriever**: 類似度計算、top-N フィルタリング

### 統合テスト

- EpisodeStorage 経由で全フロー実行
- build → retrieve の結果が分割前と同一か確認

---

## 参考

- [feature-types.md](feature-types.md)
- [word-embedding.md](word-embedding.md)
- [text-embedding.md](text-embedding.md)
- [attention-embedding.md](attention-embedding.md)
- [matrix-pipeline.md](matrix-pipeline.md)
- [retrieval-logic.md](retrieval-logic.md)
