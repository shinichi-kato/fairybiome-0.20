OrchestratorPart Class
=====================

OrchestratorPartはOrchestrator.jsをworker化するラッパー。
ユーザや環境からのメッセージはこのpartへのpostMessageで渡される。
UIへの返答はこのpartのeventListenerで渡す。
Orchestratorは受け取ったメッセージを専用のbroadcast channelにpostする。

## 受け取るmessageの形式
```javascript
message= {
        "role": "user" | "bot" | "eco",
        "text": string,
        "date": 1/1 ~ 12/31,
        "time": 0:00~23:59
        "emo": "joy" | "trust" | "fear" | "surprise" | "sadness" | "disgust"| " anger" | "anticipation",
        "facing": "face" | "back"
        "location": "private" | "public"
    }
```

チャットボットには以下の状態がある

| 状態名    | 意味                                             |
|-----------|--------------------------------------------------|
| starting  | orchestratorのdeploy中                           |
| standBy   | 出現前。出現チェックのorchestratorのみdeploy済み |
| deploy    | 全パートdeploy中                                 |
| ready     | 全パート返答が可能な状態                         |
| polling   | 返答の受付中                                     |

## starting

deployNotOnStage(botName, firestore_token)を実行。
完了したらstandByに遷移。

## standBy
メッセージ入力を待機しretrieveNotOnStage(message)を実行。
戻り値のtext中に"{START}"が含まれていたらdeployに遷移。("{START}"自体は出力文字列から除去)
それ以外をメッセージとしてUIにポスト


## deploy
* deployNotFound()を実行
* broadcast channelで全パートにdeployを要求→パートからの返答を待機し、全パートがdeployedになったらreadyに遷移

## ready

* メッセージ入力を待機
* メッセージをbroadcast channelを通して全パートに配信。intervalsから一つをランダムに選び、受容期間(msec)とし、pollingに遷移する。

## polling
受容期間の間broadcast channelから受け取ったデータをすべて保持する
その後 replyに遷移

## reply
* reply(messages)を実行する。
* UIにpostするとともにbroadcast channelにも「どのpartが採用された」という情報をpostする。
* 出力文字列に、"{BYE}"が含まれたらstandByに遷移する("{BYE}"自体は出力文字列から除去)
* そうでない場合readyに遷移する