# Attention Embedding — 文脈重み付けによる埋め込み統合

この文書は、特徴量行列計算の 6.3 セクションに対応し、Attention 機構による文脈ベクトル（Context Vector）の生成を説明します。

---

## 概要

Attention Embedding は、最新の入力メッセージと過去の会話履歴（ブロック内の各行）との関連度を計算し、その関連度に基づいて文脈ベクトルを生成します。

**目的:**
- 入力に対して「どの過去発話が最も関連があるか」を定量化
- 関連度の高い過去発話をより強く反映したベクトルを構築
- 文脈を保持しながらも、入力に適応したベクトルを得る

---

## 数式による定義

### 入力
- $\vec{x}_n$: 最新入力の埋め込みベクトル（text embedding）
- $\vec{x}_1, \vec{x}_2, \ldots, \vec{x}_{n-1}$: ブロック内の過去 $n-1$ 行の埋め込みベクトル

### 計算手順

#### Step 1: Similarity Score 計算

各行 $i$ との内積スコアを計算：
$$\text{Score}(n, i) = \vec{x}_n \cdot \vec{x}_i$$

**特徴:**
- 両ベクトルが正規化済みなら、$\text{Score} \in [-1, 1]$
- スコアが 1 に近い → テキスト内容が類似
- スコアが -1 に近い → テキスト内容が対極

#### Step 2: Softmax による重み化

スコアを softmax 関数に通し、重み分布を生成：
$$\alpha_i = \frac{\exp(\text{Score}(n, i))}{\sum_{j=1}^{n-1} \exp(\text{Score}(n, j))}$$

**特徴:**
- $\sum_i \alpha_i = 1$（確率分布）
- 高スコアの行に高い重み
- 低スコアの行にも非ゼロの重み（Attention の本質）

#### Step 3: Context Vector 生成

重み付き和で文脈ベクトルを生成：
$$\text{Context}_n = \sum_{i=1}^{n-1} \alpha_i \vec{x}_i$$

**意味:**
- 過去の全行を、関連度に応じて混合
- 最新入力と相関の高い過去発話ほど強く影響

---

## 実装例

### 疑似コード

```javascript
// Attention 計算クラス
class AttentionEmbedding {
  /**
   * @param {Array<number>} x_new - 最新入力ベクトル
   * @param {Array<Array<number>>} x_past - 過去ベクトルのリスト
   * @returns {Array<number>} context - 文脈ベクトル
   */
  computeContext(x_new, x_past) {
    if (x_past.length === 0) {
      return x_new; // 過去がなければ入力そのまま
    }

    // Step 1: スコア計算
    const scores = x_past.map(x_i => this.dotProduct(x_new, x_i));

    // Step 2: Softmax
    const weights = this.softmax(scores);

    // Step 3: Context 生成
    const context = this.weightedSum(x_past, weights);

    return context;
  }

  /**
   * ドット積（内積）
   */
  dotProduct(a, b) {
    return a.reduce((sum, val, i) => sum + val * b[i], 0);
  }

  /**
   * Softmax 関数
   */
  softmax(scores) {
    // 数値安定性: max を引く
    const maxScore = Math.max(...scores);
    const expScores = scores.map(s => Math.exp(s - maxScore));
    const sumExp = expScores.reduce((a, b) => a + b);
    return expScores.map(e => e / sumExp);
  }

  /**
   * 重み付き和
   */
  weightedSum(vectors, weights) {
    const n = vectors[0].length;
    const result = new Array(n).fill(0);
    vectors.forEach((vec, i) => {
      vec.forEach((val, j) => {
        result[j] += weights[i] * val;
      });
    });
    return result;
  }
}
```

### 実行例

#### 入力例
```javascript
const x_new = [0.6, 0.4, 0.0, 0.2];  // 最新入力

const x_past = [
  [0.5, 0.3, 0.2, 0.1],  // 過去1行
  [0.1, 0.1, 0.8, 0.0],  // 過去2行
  [0.4, 0.3, 0.1, 0.2]   // 過去3行
];
```

#### 計算
```
Step 1: スコア
Score(new, 1) = 0.6*0.5 + 0.4*0.3 + 0.0*0.2 + 0.2*0.1 = 0.36
Score(new, 2) = 0.6*0.1 + 0.4*0.1 + 0.0*0.8 + 0.2*0.0 = 0.10
Score(new, 3) = 0.6*0.4 + 0.4*0.3 + 0.0*0.1 + 0.2*0.2 = 0.36

Step 2: Softmax
exp(0.36) ≈ 1.433
exp(0.10) ≈ 1.105
exp(0.36) ≈ 1.433
sum ≈ 3.971

α_1 ≈ 1.433 / 3.971 ≈ 0.361
α_2 ≈ 1.105 / 3.971 ≈ 0.278
α_3 ≈ 1.433 / 3.971 ≈ 0.361

Step 3: Context
Context[0] = 0.361*0.5 + 0.278*0.1 + 0.361*0.4 ≈ 0.360
Context[1] = 0.361*0.3 + 0.278*0.1 + 0.361*0.3 ≈ 0.280
Context[2] = 0.361*0.2 + 0.278*0.8 + 0.361*0.1 ≈ 0.294
Context[3] = 0.361*0.1 + 0.278*0.0 + 0.361*0.2 ≈ 0.108

Result: [0.360, 0.280, 0.294, 0.108]
```

---

## ステップ 4: ベクトルの平坦化（Flatten）

### 入力

各ブロックのベクトルが 2 次元配列で整理されている状態：
```javascript
this.wordVector = [
  [vec1, vec2, vec3],  // Block 1
  [vec4, vec5]         // Block 2
];

this.indexMap = [
  [idx1, idx2, idx3],  // Block 1
  [idx4, idx5]         // Block 2
];
```

### 処理
```javascript
// 2 次元配列を 1 次元に平坦化
const flatWordVector = this.wordVector.flat();
const flatIndexMap = this.indexMap.flat();

// 結果
// flatWordVector = [vec1, vec2, vec3, vec4, vec5]
// flatIndexMap = [idx1, idx2, idx3, idx4, idx5]
```

### 目的
- 後続の検索（retrieve）で、すべての行を統一的に処理
- インデックスとベクトルの対応を保持

---

## 特別な注意点

### 温度パラメータ（Temperature）

一部の実装では softmax に「温度」パラメータを導入：
$$\alpha_i = \frac{\exp(\text{Score}(n, i) / T)}{\sum_{j=1}^{n-1} \exp(\text{Score}(n, j) / T)}$$

- $T > 1$: 分布を平坦に（すべての行がほぼ等しい重み）
- $T < 1$: 分布を鋭くシャープに（スコアの高い行に集中）
- $T = 1$: 標準的な softmax

**現在の EpisodePart.md では温度の記載なし**: 必要に応じて factor に追加可能

### 数値安定性

softmax 計算は指数関数を含むため、オーバーフロー/アンダーフロー対策が重要：
```javascript
// 数値安定版
const maxScore = Math.max(...scores);
const expScores = scores.map(s => Math.exp(s - maxScore));
```

---

## パイプラインでの位置

```
Text Embedding (6.2)
       ↓
Attention Embedding (6.3) ← このセクション
       ↓
Vector Flattening
       ↓
Matrix Builder (全体統合)
       ↓
Similarity Scoring (Retrieval)
```

---

## 参考

- Text Embedding の詳細: [text-embedding.md](text-embedding.md)
- 全体パイプライン: [matrix-pipeline.md](matrix-pipeline.md)
- Attention 機構の基礎: https://en.wikipedia.org/wiki/Attention_(machine_learning)
- Softmax 関数: https://en.wikipedia.org/wiki/Softmax_function
