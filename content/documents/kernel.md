kernel
========
本システムではチャットボットは複数のパートをworkerとして並列動作させ、それらの起動、停止、死活監視などをkernelが行う。

## 実装環境
- **言語**: TypeScript
- **実装場所**: `src/biomebot/kernel.ts`
- **実行環境**: ブラウザ (BroadcastChannel + Web Worker/SharedWorker)
- **対応状況**: 複数ボットの並列実行対応


## part
partはファイル名で種類を識別する。
現時点では`*.episode.json`と`orchestrator.json`の二種類で、全て共通のメッセージインタフェースを持つworkerプロセスである。
ソースは`/src/biomebot/worker`

partは`src/biomebot/kernel.ts`から必要に応じて**遅延ロード**（動的インポート）される。


## kernelの起動
1. `next.config.js`から各ボットの部品構成を取得
2. `/static/bots/{botName}`下に存在するjsonファイルを認識
3. 指定されたボットの`botName`に紐づく`BroadcastChannel`を初期化: `biomebot-${botName}`
4. 各部品からの応答メッセージをリッスン開始


## 通信仕様（共通）

### メッセージングチャネル
* カーネルとパート間の通信はworker専用のchennelを使用。
* パート間のメッセージやり取りはBroadcastChannel `biomebot-${botName}`を使用して行う。

### タイムアウト
- **デフォルトタイムアウト**: 3000ms (3秒)
- 各操作（activate, deactivate, report）において、カーネルは各部品からの応答を3秒以内に待つ
- タイムアウトした部品は**失敗**と標記されるが、他の部品の処理は継続（部分的失敗を許可）

### エラーハンドリング
- 部品が応答しない、またはエラーを返した場合、該当する部品を`failedParts`リストに記録
- 操作全体は完了メッセージ（`*Completed`）を返す際に、失敗した部品情報を含める
- 例: `{ type: 'activateCompleted', botName, activatedParts: [...], failedParts: [{partName, error, ...}] }`

### メッセージ蓄積・バッチ処理
`listen`操作で複数のユーザーメッセージが短時間に到着した場合、それらを蓄積してから一括でブロードキャストする（部品への負荷軽減）。


## kernelのサービス

### activate
カーネルが対象部品を起動し、メッセージ受信可能状態にする。

**リクエストメッセージ**:
```javascript
{
    type: 'activate',
    botName: 'チャットボット名',
    partNames: ['対象パート名のリスト'], // 指定時のみ
    excludedPartNames: ['除外パート名のリスト'] // 指定時のみ
}
```

**処理フロー**:
1. `partNames`が指定されている場合はそのリストを使用。指定されない場合はボットに属する全部品を対象
2. `excludedPartNames`で指定された部品は除外
3. 対象の各部品に以下を送信:
   - デプロイ済みでない場合: 部品を遅延ロード → インスタンス化 → deploy()実行
   - `{ type: 'activate' }` メッセージを送信
4. 各部品からの`{ type: 'activated' }` 応答を収集（タイムアウト: 3000ms）
5. 全部品から応答を得た場合、または3秒経過した場合に完了

**応答メッセージ**:
```javascript
{ 
    type: 'activateCompleted', 
    botName: 'チャットボット名',
    activatedParts: ['成功した部品名リスト'],
    failedParts: [
        { partName: 'X', error: 'timeout' | 'error message', ... }
    ]
}
```


### deactivate
カーネルが対象部品を停止し、メッセージ受信を中断させる。

**リクエストメッセージ**:
```javascript
{
    type: 'deactivate',
    botName: 'チャットボット名',
    partNames: ['対象パート名のリスト'], // 指定時のみ
    excludedPartNames: ['除外パート名のリスト'] // 指定時のみ
}
```

**処理フロー**:
1. `partNames`が指定されている場合はそのリストを使用。指定されない場合はボットに属する全部品を対象
2. `excludedPartNames`で指定された部品は除外
3. アクティブ状態の各部品に `{ type: 'deactivate' }` メッセージを送信
4. 各部品からの `{ type: 'deactivated', botName, partName }` 応答を収集（タイムアウト: 3000ms）
5. 全部品から応答を得た場合、または3秒経過した場合に完了

**応答メッセージ**:
```javascript
{ 
    type: 'deactivateCompleted', 
    botName: 'チャットボット名',
    deactivatedParts: ['成功した部品名リスト'],
    failedParts: [
        { partName: 'X', error: 'timeout' | 'error message', ... }
    ]
}
```


### report
カーネルが対象部品の現在の状態を照会し、ステータスレポートを集約する。

**リクエストメッセージ**:
```javascript
{
    type: 'report',
    botName: 'チャットボット名',
    partNames: ['対象パート名のリスト'] // 指定時のみ; 省略時は全部品
}
```

**処理フロー**:
1. `partNames`が指定されている場合はそのリスト。指定されない場合はボットに属する全部品を対象
2. 各部品に `{ type: 'report' }` メッセージを送信
3. 各部品からの `{ type: 'reported', stateName, content, ... }` 応答を収集（タイムアウト: 3000ms）
4. 全部品から応答を得た場合、または3秒経過した場合に完了

**応答メッセージ**:
```javascript
{ 
    type: 'reportCompleted', 
    botName: 'チャットボット名',
    reports: {
        'partName1': { stateName, content, ... },
        'partName2': { ... }
    },
    failedParts: [
        { partName: 'X', error: 'timeout' | 'error message', ... }
    ]
}
```


### listen
UIや環境からユーザーメッセージを受け取り、指定ボットのアクティブな部品へ配信する。

**リクエストメッセージ**:
```javascript
{
    type: 'listen',
    botName: 'チャットボット名',
    message: {
        text: 'ユーザー入力テキスト',
        role: 'user',
        // その他メッセージ属性
    }
}
```

**処理フロー**:
1. メッセージをボット単位のキューに蓄積
2. 蓄積されたメッセージを一括でボットのBroadcastChannelに配信:
   ```javascript
   {
       type: 'message',
       botName: 'チャットボット名',
       messages: [
           { text: '...', role: 'user', ... },
           { text: '...', role: 'user', ... }
       ]
   }
   ```
3. アクティブな部品がメッセージを受け取り処理開始


## マルチボット対応
複数のボットを同時に実行可能。各ボットは独立した状態を保持：
- 各ボット固有の`BroadcastChannel`（`biomebot-${botName}`）
- 各ボット固有の部品インスタンスキャッシュ
- 各ボット固有のメッセージキュー

ボット間の操作は相互に影響しない。