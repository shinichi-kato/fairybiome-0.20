# EpisodePart システム設計書

EpisodeStorageを使用して、会話ログから類似発話を検索し、その次行を返答候補として返すチャットボットパートの仕様です。

---

## 📋 目次

このドキュメントは、以下の 6 つのモジュール化されたマークダウンに分割されています。

### 1. [feature-types.md](feature-types.md) — 特徴量の分類と理論
- 連続的な意味の特徴量（role, text, target, facing, location）
- 周期的な特徴量（date, time, emo）
- 連続的な値の特徴量（barometer）
- 各タイプの ベクトル化方法（word embedding, [sin, cos], RBF など）

### 2. [word-embedding.md](word-embedding.md) — Word Embedding モジュール
- 単語タグ（Word Tags）ファイル形式
- 辞書の構築と embedding の正規化
- テキスト内での単語検索と埋め込み

### 3. [text-embedding.md](text-embedding.md) — Text Embedding モジュール
- TinySegmenter による分かち書き
- 複合語マッピング（助詞を含む複合語の処理）
- ブロック分割と word vector の格納

### 4. [attention-embedding.md](attention-embedding.md) — Attention Embedding モジュール
- Softmax ベースの Attention 計算
- スコア（内積）の計算と重み化
- 文脈ベクトル（Context Vector）の生成

### 5. [matrix-pipeline.md](matrix-pipeline.md) — 特徴量行列構築パイプライン
- Step 1: データファイルの読み込み
- Step 2: Word Tags ファイルの読み込み
- Step 3: 各行のベクトル化（全特徴量の統合）
- Step 4: 正規化・重み付け・連結
- Step 5: 行列形成とキャッシング
- **全体の実装フロー図を含む**

### 6. [retrieval-logic.md](retrieval-logic.md) — 返答ロジック
- **Scenario A: User Input への返答**
  - メッセージベクトル化 → 類似度計算 → 候補選択 → 返答生成 → 自問自答
- **Scenario B: Inner Speech への応答**
  - 反応性判定 → ベクトル化 → 検索 → BroadcastChannel で配信
- **Scenario C: Output 受信時の処理**
  - history への記録

### 7. [part-management.md](part-management.md) — パート管理とメッセージング
- Kernel との連携プロトコル（activate, input, report など）
- BroadcastChannel による マルチパート通信
- Worker スレッドの管理

---

## 🎯 責任マップ（モジュール vs 実装クラス）

### EpisodeStorage.js（コア実装）

**現在の責務（モノリシック）:**
- データロード、辞書構築、特徴量計算、行列構築、キャッシング、検索

**提案される分割（モジュール化後）:**

| 文書 | 責務 | 対応モジュール |
|------|------|----------------|
| [word-embedding.md](word-embedding.md) | Word tag 管理・embedding | `WordEmbedding.js` |
| [text-embedding.md](text-embedding.md) | テキスト分かち書き・複合語マッピング | `TextEmbedding.js` |
| [attention-embedding.md](attention-embedding.md) | Attention 計算 | `AttentionEmbedding.js` |
| [feature-types.md](feature-types.md) | 各特徴量の単位計算 | `FeatureExtractor.js` |
| [matrix-pipeline.md](matrix-pipeline.md) | パイプライン全体・調整 | `MatrixBuilder.js` |
| [matrix-pipeline.md](matrix-pipeline.md) | ファイルロード | `DataLoader.js` |
| [retrieval-logic.md](retrieval-logic.md) | 類似度計算・検索 | `Retriever.js` |

---

## 📊 パイプラインの全体図

```
┌────────────────────────────────────────────────────────┐
│ データファイル読み込み (DataLoader)                   │
│  - *.episode.json                                      │
│  - *.embed.json (Word Tags)                            │
└──────────────────┬─────────────────────────────────────┘
                   ↓
┌────────────────────────────────────────────────────────┐
│ 各行のベクトル化 (FeatureExtractor)                    │
│  - 連続的意味 → WordEmbedding.embed()                  │
│  - text → TextEmbedding.embed()                        │
│  - 周期的 → [sin, cos] 変換                            │
│  - 連続値 → RBF 変換                                    │
└──────────────────┬─────────────────────────────────────┘
                   ↓
┌────────────────────────────────────────────────────────┐
│ Attention 計算 (AttentionEmbedding)                     │
│  - 過去ベクトルとの Softmax 重み計算                    │
│  - 文脈ベクトル生成                                    │
└──────────────────┬─────────────────────────────────────┘
                   ↓
┌────────────────────────────────────────────────────────┐
│ 正規化・重み付け・連結 (MatrixBuilder)                │
│  - L2 正規化                                           │
│  - factor.weight で重み付け                            │
│  - ベクトル連結と再正規化                              │
└──────────────────┬─────────────────────────────────────┘
                   ↓
┌────────────────────────────────────────────────────────┐
│ 行列キャッシング (EpisodeStorage)                       │
│  - Dexie DB に保存                                     │
└────────────────────────────────────────────────────────┘
                   ↓
          ┌────────────────────┐
          │  Retrieval Ready   │
          │ (Retriever.search) │
          └────────────────────┘
```

---

## 🔄 メッセージフロー

### User Input → Response

```
User Input Message
      ↓
EpisodePart.input()
      ↓
Retriever.search(message_vector)
      ↓
[Candidate rows with scores]
      ↓
Random select → Next row
      ↓
Output message (+ self-dialog if target='self')
      ↓
History に記録
      ↓
返答リスト返却
```

### Inner Speech → Broadcasting

```
Inner Speech Message (from orchestrator)
      ↓
EpisodePart.inputinnerVoice()
      ↓
Reactivity check (random < factor.reactivity)
      ↓
Retriever.search() [if react == true]
      ↓
BroadcastChannel post
      ↓
orchestrator が収集
```

---

## 📦 辞書ファイル形式

### *.episode.json（会話データ）

```json
{
  "description": "パートの説明",
  "author": "作成者",
  "factor": {
    "amplitude": 0.6,
    "precision": 0.4,
    "reactivity": 0.7,
    "weight": {
      "role": 0.2, "text": 0.3, "target": 0.2, "date": 0.2,
      "time": 0.1, "emo": 0.1, "facing": 0.1, "location": 0.1
    }
  },
  "columns": ["role", "text", "target", "date", "time", "emo", "facing", "location"],
  "data": [
    "# トピック1",
    ["bot", "こんにちは", "other", "10/12", "12:23", "laugh", "face", "private"],
    ["user", "元気?", "other", "10/12", "12:23", "", "face", "private"],
    null
  ]
}
```

---

## 🔑 主要パラメータ

| パラメータ | 範囲 | 意味 |
|-----------|------|------|
| `amplitude` | [0, 1] | 返答スコアの減衰係数 |
| `precision` | [0, 1] | 類似度しきい値（高 = 厳選） |
| `reactivity` | [0, 1] | innerVoice 反応確率 |
| `weight.*` | [0, 1] | 各特徴量の重み付け係数 |

---

## 🛠 実装の段階化

### フェーズ 1 ✅ ドキュメント再構成（本来ここ）
- [ ] 6 つのマークダウン作成 ← **進行中**
- [ ] 図解追加
- [ ] 責任マップ統合

### フェーズ 2 〜 4（次の段階）
- [ ] 実装責任整理
- [ ] モジュール分割実装
- [ ] テスト & 検証

---

## 📖 参照先

### ソースコード
- [EpisodeStorage.js](../../src/EpisodeStorage/EpisodeStorage.js) — コア実装
- [EpisodePart.js](../../src/biomebot/parts/episode/EpisodePart.js) — Part ラッパー
- [EpisodePart.worker.js](../../src/biomebot/parts/episode/EpisodePart.worker.js) — Messaging

### 関連設計書
- [EpisodeStorage.md](../../src/EpisodeStorage/EpisodeStorage.md) — DB 仕様

---

**作成日**: 2026-08-14  
**ステータス**: ドキュメント分割中（フェーズ 1）
