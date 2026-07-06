Orchestrator
============

ユーザや環境から受け取ったメッセージをパートに配信し、
パートから受け取ったメッセージを統合する特殊なパート。
そのうちworker部分以外のロジックを記述。ここで定義した関数を
OrchestratorPartClass.mdに記載したOrchestratorPartでworker化する。

static/bots/{botName}/orchestrator.jsonを読む。内容は以下の通り
```json
{
    "title": "Orchestrator",
    "factor": {
        "intervals": [300,200,250],
        "attenuation": 0.7
    },
    "notFound":{
        "factor": {
            "activity": 1,
            "precision": 0.4
        },
        "columns": ["role","text","date","time","emo","facing", "location"],
        "data": [
            ["user","？", null,null,"期待","private"],
            ["bot","うーん",null,null,"期待","private"]
        ]
    },
    "notOnStage": {
        "factor": {
            "activity": 1,
            "precision": 0.4
        },
        "columns": ["role","text","date","time","emo","location"],
        "data": [
            ["user","おーい",null,"8:30","期待","private"],
            ["bot","はーい{START}",,null,"8:30","期待","private"]
        ]
    }

 
}
```
## deployNotOnStage(botName, firestore_token)
上記のファイルを読みstandByセクションをEpisodeStorageでdeploy

## retrieveNotOnStage(message)

* standByセクションを使用してユーザの呼びかけに応じて返答を生成して返す。

## deployNotFound()
* notFoundセクションをEpisodeStorageでdeploy

## retrieveNotFound(message)

* notFoundセクションを使用して返答を生成して返す。


## reply(messages)
受容期間中にpartから受け取った全データをmessageとして受け入れる

* n番目に来たメッセージのスコアをattenuation^n倍することで減衰させる（＝話しすぎない）
* 返答が帰ってこなかった場合text={SILENCE}で日付や時刻は現在の値を使い、retrieveNotFound()を返す。
* 最もスコアの高いものを選んで返す。


