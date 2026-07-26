Orchestrator
============


* ユーザや環境から
ユーザや環境から受け取ったメッセージをパートに配信し、
パートから受け取ったメッセージを統合する特殊なパート。
そのうちworker化部分以外のロジックを記述。ここで定義した関数を
OrchestratorPartClass.mdに記載したOrchestratorPartでworker化する。

static/bots/{botName}/orchestrator.jsonを読む。内容は以下の通り
```json
{
    "title": "Orchestrator",
    "factor": {
        "intervals": [300,200,250],
        "attenuation": 0.7
    },
    "tags": [
    {
      "surfaces": ["{bot}"],
      "embedding": {"アウルラ": 1.0}
    }
  ],
 
}
```
## deploy0()
* kernelへのmessageで全パートをdeactivate
* kernelへのmessageでoffstageパートのactivate

## retrieve0(message)
* standByセクションを使用してユーザの呼びかけに応じて返答を生成して返す。


## retrieveNotFound(message)
* notFoundセクションを使用して返答を生成して返す。


## reply(messages)
受容期間中にpartから受け取った全データをmessageとして受け入れる

* n番目に来たメッセージのスコアをattenuation^n倍することで減衰させる（＝話しすぎない）
* 返答が帰ってこなかった場合text={SILENCE}で日付や時刻は現在の値を使い、retrieveNotFound()を返す。
* 最もスコアの高いものを選んで返す。


