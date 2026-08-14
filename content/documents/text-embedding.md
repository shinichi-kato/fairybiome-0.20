# Text Embedding — テキスト分かち書きと複合語マッピング

この文書は、特徴量行列計算の 6.2 セクションに対応し、テキスト列の embedding 処理を説明します。text は他の特徴量と異なり、TinySegmenter による分かち書きと複雑な複合語ロジックを必要とします。

---

## 概要

Text Embedding の目的：
- 発話内容を、word vector として embedding 化
- 複合語や助詞の扱いにより、文法的バリエーション（語順変更など）に対応
- ブロック単位で整理し、Attention 機構で文脈情報を統合

---

## ステップ 1: ブロック分割（Block Segmentation）

### 入力: dataArray
```javascript
[
  "# 話題1",  // separator 行（ブロック境界）
  ["bot", "こんにちは", ...],
  ["user", "元気ですか", ...],
  "# 話題2",  // separator 行
  ["bot", "はい！", ...],
  null  // 行末マーカー
]
```

### 処理
```javascript
// null 行またはテキスト行（文字列）を区切り線とみなす
// 連続するデータ行のみをブロックとして扱う
```

### 出力: ブロックのグループ化
```
Block 1: [
  ["bot", "こんにちは", ...],
  ["user", "元気ですか", ...]
]

Block 2: [
  ["bot", "はい！", ...]
]
```

**重要:**
- separator 行（テキスト行・null 行）は埋め込み対象外
- 各ブロック末尾の行も埋め込み対象外（retrieval で次行が存在しないため）

---

## ステップ 2: TinySegmenter による分かち書き

### TinySegmenter について
- 小規模な日本語テキスト分かち書きツール（形態素解析ライブラリなしで動作）
- ファイル: `_legacy/biomebot-021/tinysegmenter.js`

### 処理例
```javascript
const segmenter = new TinySegmenter();
const text = "私は学校に行く";
const tokens = segmenter.tokenize(text);
// → ["私", "は", "学校", "に", "行く"]
```

### 利用箇所
- 各 text 列（row[1]）に対して実行
- テキストを単語トークンのリストに変換
- **逆順でトラバース**: 後ろから前へ走査（複合語マッピングのため）

---

## ステップ 3: 複合語マッピング（Compound Word Handling）

### 問題設定

発話「私は学校に行く」と「学校に私は行く」は意味的にほぼ同じですが、単純に tokenize すると異なるベクトルになってしまいます。

**解決策**: 助詞の前の単語を遡ることで、文法的なバリエーションを吸収する。

### 処理フロー

```javascript
// 逆順でトレース: ["行く", "に", "学校", "は", "私"]
tokens.reverse();

tokens.forEach((token, idx) => {
  // 1. 格助詞・副助詞・接続助詞を判定
  if (isParticle(token)) {
    const prev = tokens[idx - 1];
    const combined = prev + token;  // "学校" + "に" → "学校に"
    
    // 2. 複合語が WordTags に含まれるか確認
    if (wordTags.dict[combined]) {
      // あれば embedding を取得
      embedding = wordTags.dict[combined];
      wordVector.push(embedding);
    } else {
      // 無ければ、前の単語と複合語を 0.5 ずつの重みで追加
      if (wordTags.dict[prev]) {
        wordVector.push({ [prev]: 0.5 });
      }
      wordVector.push({ [combined]: 0.5 });
    }
  } else {
    // 助詞でなければ、通常のマッピング
    if (wordTags.dict[token]) {
      wordVector.push(wordTags.dict[token]);
    }
  }
});
```

### 助詞の種類

```javascript
const particles = {
  "格助詞": ["が", "を", "に", "へ", "から", "まで", "より", "的"],
  "副助詞": ["も", "ぐらい", "ほど", "くらい", "など"],
  "接続助詞": ["て", "たり", "ば", "けれど", "が", "のに", "のは"]
};
```

### 複合語マッピング例

#### 例 1: 辞書に「学校に」が存在
```
入力:  "学校に"
処理:  複合語をそのまま embedding に変換
出力:  wordVector に embedding を追加
```

#### 例 2: 辞書に「学校に」が無い
```
入力:  "学校に"
処理:  前の単語「学校」と複合語「学校に」を分割
出力:  wordVector.push({ "学校": 0.5, "学校に": 0.5 })
```

**効果:**
- 「私は学校に行く」 → [..., {"学校": 0.5, "学校に": 0.5}, ...]
- 「学校に私は行く」 → [..., {"学校": 0.5, "学校に": 0.5}, ...] （同じベクトル）

---

## ステップ 4: ブロックごとの word vector 格納

### データ構造

```javascript
this.wordVector = [
  [  // Block 1
    [...embedding for row 0...],
    [...embedding for row 1...],
    // ブロック末尾の行は除外
  ],
  [  // Block 2
    [...embedding for row N...],
  ]
];

this.indexMap = [
  [  // Block 1
    0,  // row index（データ配列全体での位置）
    1,
  ],
  [  // Block 2
    N,
  ]
];
```

### 注意点

1. **Separator 行の除外**
   - null や テキスト行は wordVector に追加しない
   - indexMap にも追加しない

2. **ブロック末尾行の除外**
   - 各ブロックの最後の行を除外
   - 理由: retrieve() で仮にヒットした場合、返答用の「次の行」が存在しないため
   - 検索対象から外すことで、不完全な返答を防止

3. **ブロック末尾行の判定**
   ```javascript
   // ブロック末尾か確認
   if (rowIndex === blockEndIndex - 1) {
     // 除外
     continue;
   }
   ```

---

## ステップ 5: Embedding ベクトルの正規化と統合

このステップは次の文書（[attention-embedding.md](attention-embedding.md)）で詳述されますが、概要：

1. 各ブロックの embedding リスト → Attention 計算
2. Attention により「最新の入力 vs 過去の行」の関連度を算出
3. 関連度を重みとして、文脈ベクトル（Context）を生成
4. 最終的な text embedding ベクトルに統合

---

## 実装例

```javascript
// TextEmbedding クラスの概念実装
class TextEmbedding {
  constructor(segmenter, wordTags) {
    this.segmenter = segmenter;
    this.wordTags = wordTags;
  }

  embedBlock(block, blockIndex) {
    const result = [];
    const indexList = [];

    block.forEach((row, rowIdx) => {
      // ブロック末尾は除外
      if (rowIdx === block.length - 1) return;

      const textCol = row[1]; // text 列
      const tokens = this.segmenter.tokenize(textCol);
      tokens.reverse(); // 逆順でトラバース

      const embedding = this.processTokens(tokens);
      result.push(embedding);
      indexList.push(blockIndex * 1000 + rowIdx); // グローバルインデックス
    });

    return { embedding: result, indexList };
  }

  processTokens(tokens) {
    const embedding = {};
    tokens.forEach((token, idx) => {
      if (this.isParticle(token) && idx > 0) {
        const prev = tokens[idx - 1];
        const combined = prev + token;

        if (this.wordTags.dict[combined]) {
          // 複合語辞書に存在
          Object.assign(embedding, this.wordTags.dict[combined]);
        } else {
          // 存在しない → 分割
          embedding[prev] = (embedding[prev] || 0) + 0.5;
          embedding[combined] = (embedding[combined] || 0) + 0.5;
        }
      } else {
        // 非助詞
        const emb = this.wordTags.dict[token];
        if (emb) {
          Object.assign(embedding, emb);
        }
      }
    });
    return embedding;
  }

  isParticle(token) {
    const particles = ["が", "を", "に", "へ", "は", "も", "ぐらい", "て", "ば"];
    return particles.includes(token);
  }
}
```

---

## エラーハンドリング

### 空文字列の処理
```javascript
if (!textCol || textCol.trim() === "") {
  // スキップ
  continue;
}
```

### 分かち書き失敗時
- TinySegmenter は常に配列を返す（失敗時も空配列）
- 追加のエラーハンドリング不要

### 歯抜けロジック
- 複合語が辞書に無い場合、常に「分割」で対応
- 未登録単語の embediding は空で処理

---

## 参考

- TinySegmenter ドキュメント（実装に含まれる）
- Word Embedding 詳細: [word-embedding.md](word-embedding.md)
- Attention 統合: [attention-embedding.md](attention-embedding.md)
- 全体パイプライン: [matrix-pipeline.md](matrix-pipeline.md)
