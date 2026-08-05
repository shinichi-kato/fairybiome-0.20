Part class
==========
パートの基底クラス
## データの読み込み
各パートのデータはstaticディレクトリから読み込む固定データとサーバーのDBから読み込む学習データ

## part管理の通信(workerの仕様)
workerのmessagingチャンネルを使用
### deploy (kernel -> part)
**受け取るメッセージ**
```
{ type: 'deploy',botName }
```
**処理**
* サブクラスではデータの読み込みと検索の準備

**返すメッセージ**
{ type: 'deployed'}
or
{ type: 'error', messages}

### activate (kernel -> part)
**受け取るメッセージ**
```javascript
{ type: 'activate' }
```
**処理**
this.isActivateをtrueに
**返すメッセージ**
{ type: 'activated'}

### deactivate (kernel -> part)
**受け取るメッセージ**
```javascript
{ type: 'deactivate' }
```
**処理**
this.isActiveをfalseに
**返すメッセージ**
```
{type: 'deactivated'}
```

### report (kernel -> part)
**受け取るメッセージ**
{type: 'report'}
**処理**
**返すメッセージ**
```
{type: 'reported', stateName, content, ...}
```
## 会話データのメッセージング
broadcastChannel(`biomebot-${botName}`)を使用
### post(ui -> 全part)
**受け取るメッセージ**
```
{type: 'post',message}
```
**処理**
active状態の各パートはメッセージを受取り、返答をするか決める。
返答する場合は下記innerSpeechメッセージを使用する。
**返すメッセージ**
なし

### innerSpeech(part->part)
**受け取るメッセージ**
```
{type: 'innerSpeech',message}
```
**処理**
active状態の各パートはメッセージを受取り、返答をするか決める。
返答する場合はinnerSpeechメッセージを使用する。
**返すメッセージ**

### 返答の送出(part->ui)
partを継承したクラスorchestratorはinnerSpeechを受信し、統合してUI側に返答する。
**送出するメッセージ**
```
{type: 'botPost',message}
```



## クラス
## プロパティ
```javascript
this.isActive;  //isActiveがtrueのときはbroadcastMessageを受け付ける
```
## メソッド
前述のメッセージングに対応したメソッド
### constructor(botName,partName)
* broadcast channel `biomebot-${botName}`の生成
*
### deploy()
* 継承クラスで実装
### activate()
* 継承クラスで実装
### deactivate()
* 継承クラスで実装
### report()
* 継承クラスで実装
### 
* 継承クラスで実装
