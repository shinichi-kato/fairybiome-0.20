# 返答ロジック — 入力・innerSpeech・出力の処理

この文書は、EpisodeStorage が入力メッセージを受け取ってから、返答を生成するまでのロジックを説明します。3 つのシナリオをカバー：

1. **User Input** — ユーザー入力への返答
2. **Inner Speech** — 他のパートからの内部発話への応答
3. **Output** — orchestrator からの最終出力の処理

---

## 概要フロー

```
┌──────────────────┐
│  User Input      │
│  Inner Speech    │ ── Message 受信
│  Output          │
└─────────┬────────┘
          │
          ↓
┌──────────────────────────────────────┐
│ 1. メッセージのベクトル化            │
│    (特徴量行列の計算と同じ方法)      │
└─────────────────┬────────────────────┘
                  │
                  ↓
┌──────────────────────────────────────┐
│ 2. Cos 類似度の計算                  │
│    matrix × message_vector           │
└─────────────────┬────────────────────┘
                  │
                  ↓
┌──────────────────────────────────────┐
│ 3. スコア・ランキング                │
│    (シナリオごとに異なる)            │
└─────────────────┬────────────────────┘
                  │
                  ↓
┌──────────────────────────────────────┐
│ 4. 返答の生成                        │
│    (message or innerSpeech)          │
└──────────────────────────────────────┘
```

---

## Scenario A: User Input への返答

### アルゴリズム

1. **メッセージのベクトル化**
   - 入力 message を、特徴量行列計算と同じ方法でベクトル化
   - history に含まれる text は、Attention で畳み込む

2. **類似度計算**
   - $\text{similarity}(i) = \vec{message} \cdot \vec{matrix[i]}$
   - 各行との cos 類似度を計算

3. **候補選択**
   - 類似度が `factor.precision` より大きい行を候補に
   - 上位 3 行を選択（複数ある場合）
   - 候補がなければ `[]` を返す

4. **返答生成**
   - 候補からランダムに 1 行選択
   - その「次の行」を メッセージ化して返答
   - スコアに `factor.amplitude` を乗じる
   - `message.target` が `"self"` なら、2 回目の処理へ（ステップ 5）

5. **Self-Dialog（自問自答）**
   - 返答 message の target が `"self"` の場合
   - その message を新たな入力として、ステップ 1-4 を再実行
   - 出力 message を 2 つ返す

6. **History 更新**
   - 入力 message を history に追加

7. **返答リスト返却**
   - 生成した message リストを返す

### 疑似コード

```javascript
async input(message) {
  // 1. メッセージをベクトル化
  const messageVector = await this.embedMessage(message);

  // 2. 類似度計算
  const similarities = this.matrix.map(row => 
    dotProduct(messageVector, row)
  );

  // 3. スコアリング・ランキング
  const candidates = [];
  for (let i = 0; i < this.matrix.length - 1; i++) {  // 最後の行は除外
    if (similarities[i] > this.factor.precision) {
      candidates.push({
        index: i,
        score: similarities[i]
      });
    }
  }

  if (candidates.length === 0) return [];

  // 上位 3 行に限定
  candidates.sort((a, b) => b.score - a.score);
  const topCandidates = candidates.slice(0, 3);

  // 4. ランダム選択
  const selected = topCandidates[
    Math.floor(Math.random() * topCandidates.length)
  ];

  // 次の行を返答として取得
  const nextRowIndex = selected.index + 1;
  const nextRow = this.data[nextRowIndex];
  let outputMessage = this.rowToMessage(nextRow, selected.score * this.factor.amplitude);

  // 5. Self-Dialog チェック
  const outputs = [outputMessage];
  if (outputMessage.target === 'self') {
    // 再帰的に入力として処理
    const selfDialogs = await this.input(outputMessage);
    outputs.push(...selfDialogs);
  }

  // 6. History 更新
  this.messageHistory.push(message);

  // 7. 返答リスト返却
  return outputs;
}
```

---

## Scenario B: Inner Speech への応答

### 目的

他のパート（例：orchestrator）が配信した innerSpeech に対して、EpisodePart が「反応」するかどうかをランダムに判定し、反応する場合は innerSpeech として返答を配信。

### アルゴリズム

1. **反応性の判定**
   - 0-1 の乱数を生成
   - `random < factor.reactivity` なら以下を実行
   - そうでなければ終了（反応なし）

2. **メッセージのベクトル化**
   - User Input と同じ方法でベクトル化

3. **類似度計算**
   - matrix との内積を計算

4. **候補選択**
   - 類似度が `factor.precision` より大きい上位 3 行
   - 1 つもなければ終了

5. **ランダム選択**
   - 候補から 1 行を選択

6. **返答生成**
   - 次の行を innerSpeech として配信
   - **重要**: User Input と異なり、自動返答はしない（自問自答なし）

7. **Broadcasting**
   - `BroadcastChannel('biomebot-${botName}')` で配信

### 疑似コード

```javascript
async inputInnerSpeech(message) {
  // 1. 反応性判定
  const random = Math.random();
  if (random >= this.factor.reactivity) {
    return;  // 反応しない
  }

  // 2-4: User Input と同じ（候補選択まで）
  const messageVector = await this.embedMessage(message);
  const similarities = this.matrix.map(row => 
    dotProduct(messageVector, row)
  );

  const candidates = [];
  for (let i = 0; i < this.matrix.length - 1; i++) {
    if (similarities[i] > this.factor.precision) {
      candidates.push({ index: i, score: similarities[i] });
    }
  }

  if (candidates.length === 0) return;

  candidates.sort((a, b) => b.score - a.score);
  const topCandidates = candidates.slice(0, 3);

  // 5. ランダム選択
  const selected = topCandidates[
    Math.floor(Math.random() * topCandidates.length)
  ];

  // 6. 返答生成
  const nextRow = this.data[selected.index + 1];
  const outputMessage = this.rowToMessage(nextRow, selected.score * this.factor.amplitude);

  // 7. Broadcasting
  const channel = new BroadcastChannel(`biomebot-${this.botName}`);
  channel.postMessage({
    type: 'innerSpeech',
    payload: outputMessage
  });
  channel.close();
}
```

### 重要な違い

| 項目 | User Input | Inner Speech |
|------|-----------|--------------|
| 反応性判定 | 常に処理 | `random < reactivity` |
| 自問自答（self-dialog） | あり | なし |
| 返却方法 | 関数の戻り値 | BroadcastChannel で配信 |

---

## Scenario C: Output 受信時の処理

### 目的

orchestrator が複数の innerSpeech を統合して最終出力（output）を生成し、それを EpisodePart に通知。EpisodePart は output を history に記録するのみ。

### アルゴリズム

1. **Output message 受信**
   - BroadcastChannel で受信

2. **History 追加**
   - output message を messageHistory に追加
   - キャッシュとして保持（後続の Attention 計算で参照可能）

### 疑似コード

```javascript
setupBroadcastListener() {
  const channel = new BroadcastChannel(`biomebot-${this.botName}`);
  
  channel.onmessage = (event) => {
    const { type, payload } = event.data;

    if (type === 'output') {
      // 1. Output message を受信
      const outputMessage = payload;

      // 2. History に追加
      this.messageHistory.push(outputMessage);

      console.log('Output recorded:', outputMessage);
    }
  };
}
```

### History の役割

History は、後続のメッセージ処理で Attention 計算に使用：

```javascript
// embedMessage() 内で history の text を参照
async embedMessage(message) {
  const textEmbedding = await this.embedText(message.text);
  
  // history の過去 text との Attention を計算
  const attentionContext = this.computeAttention(
    textEmbedding,
    this.messageHistory.map(m => m.text)
  );

  // ... 最終ベクトルに統合
}
```

---

## 参数サマリー

### factor オブジェクト

```javascript
{
  amplitude: number,      // [0, 1] 返答スコアの振幅（減衰）
  precision: number,      // [0, 1] 類似度のしきい値
  reactivity: number,     // [0, 1] innerSpeech への反応確率
  weight: {
    role: 0.2,            // 各列の重み（正規化時の重み付け係数）
    text: 0.3,
    target: 0.2,
    date: 0.2,
    time: 0.1,
    emo: 0.1,
    facing: 0.1,
    location: 0.1,
    barometer: 0.1
  }
}
```

### パラメータの意味

- **amplitude**: 返答の確度・信頼度を表す。高いほど「確信度が高い返答」を表現（スコア = 類似度 × amplitude）
- **precision**: 検索のしきい値。低いほど「曖昧な返答も許容」、高いほど「完全一致のみ」
- **reactivity**: innerSpeech への反応性。低いと反応が少ない、高いと頻繁に反応

---

## メッセージング

### BroadcastChannel 使用

```javascript
// リスナー側
const channel = new BroadcastChannel(`biomebot-${botName}`);
channel.onmessage = (event) => {
  const { type, payload } = event.data;
  // type: 'innerSpeech' | 'output' など
};

// 送信側
const channel = new BroadcastChannel(`biomebot-${botName}`);
channel.postMessage({ type: 'innerSpeech', payload: message });
```

### メッセージ構造

```javascript
{
  type: 'innerSpeech' | 'output',
  payload: {
    role: 'bot' | 'user',
    text: string,
    target: 'self' | 'other',
    timestamp: ISO8601 string,
    emo: string,
    facing: string,
    location: string,
    displayName: string,      // パート名など
    score: number,            // 類似度スコア
    props: {
      botName: string,
      partNames: [string],
      // 他のメタデータ
    }
  }
}
```

---

## エラーハンドリング

### Invalid Input
```javascript
if (!message || typeof message !== 'object') {
  return { status: 'error', message: 'invalid input' };
}
```

### Empty Matrix
```javascript
if (!this.matrix || this.matrix.length === 0) {
  return [];  // 候補なし
}
```

### Embedding Failure
```javascript
try {
  const vector = await this.embedMessage(message);
} catch (err) {
  console.error('Embedding failed:', err);
  return [];
}
```

---

## パイプラインの実装責任分界

### ロジック側（EpisodePart.js）
- `receive(message)` — 類似度計算・候補選択
- `input(message)` — User Input 処理（自問自答含む）
- `inputInnerSpeech(message)` — Inner Speech 処理

### メッセージング側（EpisodePart.worker.js）
- BroadcastChannel の設定・リスニング
- `postMessage` による kernel との連携
- メッセージ型の判定・ルーティング

### 分離の利点
- ロジックはテスト可能（メッセージング依存なし）
- メッセージング層は再利用可能（他の形式への拡張容易）

---

## 参考

- 特徴量行列計算: [matrix-pipeline.md](matrix-pipeline.md)
- Attention: [attention-embedding.md](attention-embedding.md)
- 実装側詳細: [../biomebot/parts/episode/EpisodePart.js](../biomebot/parts/episode/EpisodePart.js)
