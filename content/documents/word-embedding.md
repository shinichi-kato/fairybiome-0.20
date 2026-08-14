# Word Embedding — 予め定義された単語の埋め込み

この文書は、特徴量行列計算の 6.1 セクションに対応し、事前に定義された単語のラベルを embedding ベクトルにマッピングするプロセスを説明します。

## 概要

Word Embedding は、テキスト内で見つかった既知の単語（タグ）を、事前計算された embedding ベクトルに変換するステップです。これにより、単語の意味情報を ベクトル空間に埋め込むことができます。

---

## 単語タグ（Word Tags）ファイル形式

### ファイル場所
```
/static/common/*.embed.json
/static/common/feature_${columnName}.embed.json
/static/bots/${botName}/tags/
```

### JSON 構造例

```json
[
  {
    "surfaces": ["兄", "お兄さん", "兄貴"],
    "embedding": {
      "兄": 1.0,
      "兄弟": 0.3,
      "家族": 0.1
    }
  },
  {
    "surfaces": ["兄弟", "姉妹"],
    "embedding": {
      "兄弟": 1.0,
      "姉妹": 0.6,
      "家族": 0.3
    }
  }
]
```

**項目説明:**
- `surfaces` (必須、配列)
  - 同じ embedding を指す複数の表層形（同義語、異表記など）
  - `["兄", "お兄さん", "兄貴"]` → すべて同じ embedding を参照
  
- `embedding` (必須、オブジェクト)
  - キー：概念名（テキスト）
  - 値：重み（0.0 ～ 1.0 の実数）
  - 複数の概念を混合することで、複雑な意味を表現

---

## 処理フロー

### Step 1: タグファイルの読み込み

```javascript
async readWordTags(path) {
  // 指定パスから JSON を取得
  // addWordTags() に渡す
}
```

**特徴:**
- 複数のタグファイルを順番に読み込める
- `this.WordTags.dict` に累積される

### Step 2: Word Tags 辞書の構築

```javascript
addWordTags(data, source = 'inline') {
  // data: タグ情報の配列
  // source: ファイルパス（ログ用）
  
  // 1. embedding の正規化
  // 2. surface ごとに辞書エントリ作成
  // 3. surface を長さでソート（長い順）
}
```

**辞書構造:**
```javascript
this.WordTags.dict = {
  "兄": { 
    index: 0, 
    embedding: { "兄": 1.0, "兄弟": 0.3, "家族": 0.1 }, 
    groupId: 0 
  },
  "お兄さん": { 
    index: 1, 
    embedding: { "兄": 1.0, "兄弟": 0.3, "家族": 0.1 }, 
    groupId: 0 
  },
  // ...
};

this.WordTags.groups = {
  0: { surfaces: ["兄", "お兄さん", "兄貴"] },
  1: { surfaces: ["兄弟", "姉妹"] },
  // ...
};
```

**ソート順序:**
- 長い surface 優先（例：`"お兄さん"` が `"兄"` より先）
- 同一長なら字句順（localeCompare）
- **理由**: テキスト検索時に、長い単語を先に マッチさせることで、誤マッチを防止

### Step 3: Embedding の正規化

```javascript
_normalizeEmbedding(embedding) {
  // embedding 内の値が合計 1.0 になるよう規格化
  const sum = Object.values(embedding)
    .reduce((acc, val) => acc + val, 0);
  return Object.fromEntries(
    Object.entries(embedding)
      .map(([key, val]) => [key, val / sum])
  );
}
```

**例:**
```
入力:  { "兄": 1.0, "兄弟": 0.3, "家族": 0.1 }
合計:  1.4
出力:  { "兄": 0.714, "兄弟": 0.214, "家族": 0.071 }
```

**目的:**
- embedding ベクトルを確率分布として解釈可能にする
- 複数の embedding を加算するときの安定性向上

---

## テキスト内での単語検索と embedding

### テキスト例
```
「私の兄は学校に行った」
```

### 処理
1. TinySegmenter で分かち書き: `["私", "の", "兄", "は", "学校", "に", "行った"]`
2. `WordTags.dict` を長い順に検索
3. `"兄"` が辞書に見つかる
4. その embedding `{ "兄": 0.714, "兄弟": 0.214, "家族": 0.071 }` を取得
5. `this.wordVector` に加算（詳細は [text-embedding.md](text-embedding.md)）

### ベクトル化

取得した embedding オブジェクト `{ "兄": 0.714, "兄弟": 0.214, "家族": 0.071 }` は、後に以下のように ベクトルに変換されます：

1. **語彙（Vocabulary）の整理**
   - すべての embedding キーから重複なしで集合を作成
   - 例: `{"兄", "兄弟", "家族", "娘", "息子", ...}`

2. **ベクトル化**
   - 語彙の順序に従って配列化
   - 例: `[0.714, 0.214, 0.071, 0, 0, ...]`

3. **他のテキストエンベディングと統合**
   - Attention 機構により重み付け
   - 最終的な特徴量ベクトルの一部として使用（詳細は [attention-embedding.md](attention-embedding.md)）

---

## エラーハンドリング

### 警告とスキップ

以下の場合は警告を出力し、該当エントリをスキップします：

1. **surface の重複**
   ```javascript
   // 別のタグで既に登録済みの surface
   console.warn(
     `EpisodeStorage.addWordTags: ` +
     `duplicate surface "${surface}" ignored`
   );
   ```

2. **無効な embedding**
   - embedding が null / undefined
   - embedding のすべての値が 0 または合計が 0
   ```javascript
   console.warn(
     `EpisodeStorage.addWordTags: ` +
     `tag[${idx}].embedding is invalid`
   );
   ```

3. **無効な surface**
   - 空文字列
   - null / undefined
   ```javascript
   console.warn(
     `EpisodeStorage.addWordTags: invalid surface in tag[${idx}]`
   );
   ```

### ログ出力

- ファイルパスとタグインデックスを含む
- 例: `"feature_text.embed.json[3]"`
- 後続処理でのデバッグを容易にする

---

## 使用例（実装側）

### 初期化
```javascript
const episodeStorage = new EpisodeStorage();
await episodeStorage.readWordTags('/static/common/general.embed.json');
await episodeStorage.readWordTags('/static/bots/alice/tags.embed.json');
```

### テキスト処理時
```javascript
// この処理は TextEmbedding モジュールで実行
const text = "私の兄は";
const segments = tinySegmenter.tokenize(text); // ["私", "の", "兄", "は"]

// WordTags.dict を検索して embedding を取得
const embedding = episodeStorage.WordTags.dict["兄"]?.embedding;
// → { "兄": 0.714, "兄弟": 0.214, "家族": 0.071 }
```

---

## 参考

- 詳細なテキスト処理: [text-embedding.md](text-embedding.md)
- Attention 統合: [attention-embedding.md](attention-embedding.md)
- 全体的なパイプライン: [matrix-pipeline.md](matrix-pipeline.md)
