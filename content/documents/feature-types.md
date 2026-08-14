# 会話データの特徴量の分類

EpisodeStorage で処理される特徴量は、3 つのカテゴリに分類されます。各カテゴリは異なる数学的手法でベクトル化され、cos 類似度計算に用いられます。

## 1. 連続的な意味の特徴量

テキストベースの意味情報を embedding 化した特徴量です。いわゆる word embedding や semantic embedding に該当し、元々はテキストですが、word vector として表現します。

**対象列:**
- `role` — 発話者の役割（bot / user）
- `text` — 発話内容（重要）
- `target` — 対象者（other / self）
- `facing` — 対面状況（face / remote など）
- `location` — 場所（private / public など）

**特徴:**
- 最初の 4 つのうち `text` だけは、先行する行のキャンテキストを Attention 機構で畳み込む
- 各特徴量は別個に重み付けされる（`factor.weight.${columnName}`）

**処理方法:**
- word vector にマッピング（詳細は [word-embedding.md](word-embedding.md)）
- text embedding は特別な処理（詳細は [text-embedding.md](text-embedding.md)）
- 各ベクトルはユークリッドノルムで正規化（大きさ 1 に統一）

---

## 2. 周期的な特徴量

時間的または周期的な性質を持つ特徴量です。単純な連続値ではなく、周期性を保持した表現が有効です。

**対象列:**
- `date` — 日付（例: 10/12）
- `time` — 時刻（例: 12:23）
- `emo` — 感情ラベル（例: happy, laugh, angry）

**特徴:**

### Date（日付）
- 一年を $2\pi$ ラジアンとして扱う
- 例：1/1 = $0$、7/1 = $\pi$、12/31 = $2\pi$
- $\theta_{\text{date}}$ に変換後、$[\sin\theta, \cos\theta]$ をベクトル化

### Time（時刻）
- 一日を $2\pi$ ラジアンとして扱う
- 例：00:00 = $0$、12:00 = $\pi$、23:59 \approx $2\pi$
- $\theta_{\text{time}}$ に変換後、$[\sin\theta, \cos\theta]$ をベクトル化

**利点:**
- 昨日の同時刻と今日の同時刻が文脈的に近いと見なせる
- 周期的な類似性が cos 類似度計算で自然に表現される

### Emotion（感情）
- Plutchik の感情の輪（Plutchik Wheel of Emotions）に基づく
- テキストラベル（"happy", "sad", "angry" など）を角度にマッピング
- $[\sin\theta_{\text{emo}}, \cos\theta_{\text{emo}}]$ をベクトル化
- 角度による cos 類似度で「近い感情」「対極の感情」を表現可能

**感情マッピング（`/static/common/feature_emo.embed.json` から動的読み込み）:**

| 感情 | 英名 | 角度 | sin(θ) | cos(θ) |
|------|------|------|--------|--------|
| 喜び | joy | 0° | 0 | 1 |
| 信頼 | trust | 45° | 0.707 | 0.707 |
| 恐怖 | fear | 90° | 1 | 0 |
| 驚き | surprise | 135° | 0.707 | -0.707 |
| 悲しみ | sadness | 180° | 0 | -1 |
| 嫌悪 | disgust | 225° | -0.707 | -0.707 |
| 怒り | anger | 270° | -1 | 0 |
| 期待 | anticipation | 315° | -0.707 | 0.707 |

**感情の同義語（ユーザー利便性）：**
- `joy`: 喜び、嬉しい、楽しい、たのしい
- `fear`: 怖い、恐い、恐れてる、不安
- `anger`: 怒り、怒ってる、ムカつく、腹たつ
- など各感情に複数の表現が可能

**実装の利点：**
1. **ユーザー利便性** — JSON の `surfaces` 配列で複数キーを用意、表記の揺れに対応
2. **計算の軽量化** — embedding が直接 $[\sin\theta, \cos\theta]$ に変換、lookup 後即座に利用可能
3. **拡張性** — 感情の分割方法を変更する場合、JSON ファイルのみ修正で対応

**処理フロー:**
1. 感情ラベル（"happy", "怒り" など）を検索
2. マップから角度 $\theta$ を取得
3. 度数 → ラジアン変換：$\theta_{\text{rad}} = \theta_{\text{deg}} \times \frac{\pi}{180}$
4. $[\sin\theta_{\text{rad}}, \cos\theta_{\text{rad}}]$ の 2 次元ベクル化

---

## 3. 連続的な値の特徴量

単純な数値が特徴量化されたもので、大小関係や差が意味を持ちます。

**対象列:**
- `barometer` — 気圧など連続的な物理量

**処理方法:**
- 最大値が 1 になるよう規格化（正規化）
- Radial Basis Function (RBF) カーネルを使用してベクトル化
- 通常 5 次元程度のベクトルに変換

**RBF カーネル:**
$$\phi(x) = [\exp(-\gamma(x - c_1)^2), \exp(-\gamma(x - c_2)^2), \ldots, \exp(-\gamma(x - c_k)^2)]$$

- $c_i$ はセンター点（例：0, 0.25, 0.5, 0.75, 1.0）
- $\gamma$ は幅パラメータ
- RBF により、値の絶対値だけでなく「相対的な距離」が表現される

---

## 統合処理

すべての特徴量は以下のフローで統合されます：

1. **カラムごとのベクトル化**
   - 連続的な意味の特徴量 → word vector
   - 周期的な特徴量 → $[\sin\theta, \cos\theta]$ または emotion embedding
   - 連続的な値の特徴量 → RBF ベクトル

2. **正規化**
   - 各カラムのベクトルを $L2$ ノルムで正規化（大きさ 1）

3. **重み付け**
   - `factor.weight.${columnName}` で各カラムベクトルに重みを適用
   - 例：`weight.text = 0.3` なら text のベクトルを 0.3 倍

4. **連結と再正規化**
   - すべての重み付けベクトルを concatenate
   - 最終ベクトルを再度正規化（大きさ 1）

5. **類似度計算**
   - 入力メッセージと各行のベクトルについて、cos 類似度を計算
   - $\cos\text{sim} = \vec{u} \cdot \vec{v}$ （正規化済みのため）

---

## 参考資料

- **Plutchik の感情の輪**: https://en.wikipedia.org/wiki/Plutchik%27s_wheel_of_emotions
- **RBF カーネル**: https://en.wikipedia.org/wiki/Radial_basis_function_kernel
- **Radial Basis Functions**: https://en.wikipedia.org/wiki/Radial_basis_function
