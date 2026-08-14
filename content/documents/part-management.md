# パートの管理

EpisodePart の ライフサイクル管理およびメッセージング（kernel との連携）について説明します。

---

## ライフサイクル

### 状態遷移図

```
┌──────────┐
│ Inactive │
└────┬─────┘
     │ activate()
     ↓
┌──────────┐
│  Active  │
└────┬─────┘
     │ deactivate()
     ↓
┌──────────┐
│ Inactive │
└──────────┘
```

### 各状態

| 状態 | 説明 |
|------|------|
| **Inactive** | パートが初期化されているが、稼働していない。メッセージ処理は行わない |
| **Active** | パートが稼働中。メッセージ受信 → 処理 → 返答 |

---

## メッセージング（Worker）

### 使用技術

- **Web Worker** — UI スレッドとの並列実行
- **postMessage/onmessage** — スレッド間通信
- **BroadcastChannel** — マルチパート間通信（`biomebot-${botName}`）

### ファイル

```
src/biomebot/parts/episode/
├── EpisodePart.js       ← ロジック（UI スレッド）
└── EpisodePart.worker.js ← ロジック実行（Worker スレッド）
```

---

## Kernel との連携

### メッセージプロトコル

Kernel から EpisodePartWorker へのメッセージ：

#### 1. activate

```javascript
{
  type: 'activate',
  botName: string,
  partName: string,
  firestoreToken?: string  // オプション
}
```

**処理:**
- `EpisodePart.init()` を実行
- `EpisodePart.deploy()` を実行
- パートを Active 状態に

**返答:**
```javascript
{
  type: 'activated',
  status: 'ok' | 'error'
}
```

#### 2. input

```javascript
{
  type: 'input',
  message: Message  // メッセージオブジェクト
}
```

**処理:**
- `EpisodePart.input(message)` を実行
- 返答リストを返す

**返答:**
```javascript
{
  type: 'output',
  messages: Message[]
}
```

#### 3. inputInnerSpeech

```javascript
{
  type: 'inputInnerSpeech',
  message: Message
}
```

**処理:**
- `EpisodePart.inputInnerSpeech(message)` を実行
- 反応ありの場合、BroadcastChannel で innerSpeech を配信

**返答:**
```javascript
{
  type: 'ackInnerSpeech'
}
```

#### 4. report

```javascript
{
  type: 'report'
}
```

**処理:**
- `EpisodePart.report()` を実行
- パートの状態情報を返す

**返答:**
```javascript
{
  type: 'report',
  data: {
    status: 'ok',
    botName: string,
    partName: string,
    engine: 'Episode',
    factor: {...},
    columns: string[]
  }
}
```

#### 5. deactivate

```javascript
{
  type: 'deactivate'
}
```

**処理:**
- パートを Inactive 状態に

**返答:**
```javascript
{
  type: 'deactivated',
  status: 'ok'
}
```

#### 6. terminate

```javascript
{
  type: 'terminate'
}
```

**処理:**
- メモリ解放
- リソース破棄
- Worker の終了準備

**返答:**
```javascript
{
  type: 'terminated'
}
```

---

## EpisodePart.worker.js の概略

```javascript
import { EpisodePart } from './EpisodePart.js';

const part = new EpisodePart();
let isActive = false;

self.onmessage = async (event) => {
  const { type, ...payload } = event.data;

  try {
    let response;
    switch (type) {
      case 'activate':
        await part.init(payload.botName, payload.partName, payload.firestoreToken);
        await part.deploy();
        isActive = true;
        response = { type: 'activated', status: 'ok' };
        break;

      case 'input':
        if (!isActive) throw new Error('Part not active');
        const messages = part.input(payload.message);
        response = { type: 'output', messages };
        break;

      case 'inputInnerSpeech':
        if (!isActive) throw new Error('Part not active');
        await part.inputInnerSpeech(payload.message);
        response = { type: 'ackInnerSpeech' };
        break;

      case 'report':
        const report = part.report();
        response = { type: 'report', data: report };
        break;

      case 'deactivate':
        isActive = false;
        response = { type: 'deactivated', status: 'ok' };
        break;

      case 'terminate':
        // クリーンアップ
        response = { type: 'terminated' };
        break;

      default:
        throw new Error(`Unknown message type: ${type}`);
    }

    self.postMessage(response);
  } catch (err) {
    self.postMessage({
      type: 'error',
      error: err.message
    });
  }
};
```

---

## パート間通信（BroadcastChannel）

### チャネル名

```
biomebot-${botName}
```

例：`biomebot-alice`

### メッセージタイプ

#### innerSpeech（配信）

```javascript
{
  type: 'innerSpeech',
  payload: Message
}
```

**送信条件:**
- `inputInnerSpeech()` で反応判定が OK
- `factor.reactivity` をクリア

**受信者:**
- orchestrator パート（innerSpeech を統合）
- 他のパート（相互作用）

#### output（配信）

```javascript
{
  type: 'output',
  payload: Message
}
```

**送信者:**
- orchestrator パート（innerSpeech を統合した最終出力）

**受信者:**
- EpisodePart（history に記録）
- UI パート（画面表示）

---

## リソース管理

### 初期化時のリソース

1. **Dexie DB** — EpisodeStorage が管理
2. **WordTags 辞書** — メモリ上（大規模なら最適化が必要）
3. **特徴量行列** — Dexie キャッシュ
4. **BroadcastChannel** — OS 管理

### クリーンアップ

```javascript
// EpisodePart.js
async cleanup() {
  // 明示的なクリーンアップが必要な場合
  if (this.broadcastChannel) {
    this.broadcastChannel.close();
  }
  // Dexie は自動クローズ
}
```

---

## エラーハンドリング

### 一般的なエラー

| エラー | 原因 | 対応 |
|-------|------|------|
| Part not active | deactivate 後に input 呼び出し | activate から再開 |
| File not found | *.episode.json が存在しない | ファイルパス確認 |
| Invalid message | message オブジェクトが不正 | メッセージ構造確認 |
| Embedding failed | テキスト処理失敗 | テキストのエンコーディング確認 |

### エラーログ

```javascript
self.postMessage({
  type: 'error',
  error: err.message,
  stack: err.stack  // 開発時のみ
});
```

---

## パフォーマンス最適化

### キャッシング

```javascript
// Dexie により、同一 (botName, partName) の行列は再利用
// タイムスタンプ比較で更新判定
```

### Worker の利点

- UI ブロッキングなし
- 計算集約的な処理を別スレッドで実行
- 複数パートの並列処理

### 注意点

- Worker 生成のオーバーヘッド
- データシリアライゼーション（postMessage）
- メモリ使用量の増加

---

## 参考

- EpisodePart.js: [../../biomebot/parts/episode/EpisodePart.js](../../biomebot/parts/episode/EpisodePart.js)
- Kernel 実装: [../../biomebot/kernel.js](../../biomebot/kernel.js)
- BroadcastChannel API: https://developer.mozilla.org/en-US/docs/Web/API/Broadcast_Channel_API
- Web Worker: https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API
