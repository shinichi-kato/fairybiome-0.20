OrchestratorPart
================
* チャットボットの未登場↔登場という状態管理を行い、他のpartの状態をkernelを介して制御する。
* パートから受け取ったメッセージを蓄積し、定期的にそれらを統合して返答を返す

orchestrator.jsonには以下の内容を格納する
```json
{
    "title": "Orchestrator",
    "factor": {
        "intervals": [300,200,250],
        "attenuation": 0.7,
    },
    "botDisplayName": ["アウルラ"],
    "fallbacks": ["..."]
 
}
```

## パート発言の統合
```mermaid
sequenceDiagram
participant Outer@{"type": "boundary" }
participant Kernel
participant PartWorkers@{ "type" : "collections" }
    Outer->>Kernel: post()
    Kernel-)PartWorkers: input
    PartWorkers-)PartWorkers: innerSpeech
    PartWorkers-)OrchestratorWorker: innerSpeech
    OrchestratorWorker-)Kernel: output
    Kernel->>Outer: callback関数
```
外部からの刺激は他のチャットボットやユーザからの発言とエコシステムからの入力である。入力を受け取ったらkernelがbroadcast Channelでこれらを `{type: 'input'}`として配信。すべてのactive状態のパートが受信する。受信したパートは回答したければ`{type: "innerSpeech"}` としてbroadcastChannelに送信する。
また、パートはinnerSpeechに対して反応して別のinnerSpeechを発言しても良い。
Orchestratorは一定期間中のinnerSpeechを受信し、統合して `{type:"output"}`とする。これをうけとったkernelはコールバック関数でこれをUIに渡す。



## 登場↔未登場状態管理

```mermaid
flowchart LR
    start --> deploy0
    subgraph offstage
    deploy0 --> polling0
    polling0 --> integrate0
    integrate0 --> polling0
    end

    subgraph onstage
    integrate0 --> deploy1
    deploy1 --> polling1
    polling1 --> integrate1
    integrate1 --> polling1
    integrate1 --> deploy0
    end
```

### initialize
インスタンスの初期化
完了したらdeploy0に遷移

### deploy0
* kernelに「orchestrator以外全パートdeactivate」をpost
  -> {type:"deactivate",botName,excludedPartNames:["orchestrator"]}
* kernelに「offstageパートのactivate」をpost。
  -> {type:"activate",botName,partNames:["offstage"]}
完了したらpolling0に遷移

* report時返答: 状態名


### polling0
* factor.intervalsからランダムに一つを選び、そのintervalでタイマーを開始。終了時にintegrate0に遷移

* report時返答: 状態名, インターバル開始時刻、インターバル長


### integrate0
* 内言メッセージ（パートからの発言）があればそれらのうち最もスコアの高いものを選びbroadcast channelに{type:'speech',message}でポスト。なお発言に"{ONSTAGE}"が含まれていたら{ONSTAGE}は削除しておく。
* 蓄積した全メッセージをクリア
* 発言に{ONSTAGE}があった場合deploy1に遷移。そうでなければpolling0に遷移。

* report時返答: 状態名,全メッセージリスト

### deploy1
* kernelに「orchestrator以外全パートdeactivate」をpost
　ｰ>{type:"deactivate",botName,excludedPartNames:["orchestrator"]}
* kernelに「offstageパート以外のactivate」をpost
  ->{type:"activate",botName,excludedPartNames:["offstage"]}
完了したらpolling1に遷移

* report時返答: 状態名,全メッセージリスト

### polling1
* factor.intervalsからランダムに一つを選び、そのintervalでタイマーを開始。終了時にintegrate1に遷移

### integrate1
* n番目に来たメッセージのスコアをattenuation^n倍することで減衰させる（＝話しすぎない）
* 返答が帰ってこなかった場合のフォールバックはfallbacksからランダムに一つを選んで使用。（スコアが低い場合は通常notFoundパートが返事をする。それもなかった場合なのでエラーの可能性が大きい）
* 最も高いスコアをhとしたとき、h*0.9以上を返答する。

* 発言の中に"{OFFSTAGE}"が含まれた場合、{OFFSTAGE}を除去して返答を行い、deploy0に遷移する。"{OFFSTAGE}"が含まれない場合はpolling1に遷移する。
* report時返答: 状態名,全メッセージリスト


## カーネルとの通信

### activate　(kernel -> orchestrator)
{type: "activate"}
を受け取ったら
* broadcast channelからのメッセージを受け取るモードになる。
* {type: "activated"}をworkerのchannelにポストする

### deactivate (kernel -> orchestrator)
{type: "deactivate"}
を受け取ったらbroadcast channelからのメッセージを受け取らないモードになる。
* {type: "deactivated"}をworkerのchannelにポストする

### report (kernel->orchestrator)
{type: "report"}を受け取ったら
{type: "reported", stateName, レポート内容}をworkerのchannelにポストする。