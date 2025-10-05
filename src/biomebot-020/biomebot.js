/*
Biomebot
========

## チャットボットのデプロイ
chatbotの辞書データ管理にはgraphql,firestore,indexedDbの三箇所を利用する。
最初期のデータはgraphql上にあり、それをfirestoreにアップロードした後indexedDBに
ダウンロードする。以降はfirestoreの更新とindexedDBへの反映を行うことで
チャットボットの記憶を永続化する。

## workerPool
workerPool={
    [botId]: [{
        [moduleName]: {
            worker: null,

        }
    }, ...]
    ,...
}

## workerとのMessagingインタフェース

worker付属のonMessageを使った通信ではworkerの起動・停止などの管理や
今の状態の報告を行う。

| type             | 送出メッセージ | 成功時の応答 | 失敗時の応答
|------------------|----------------|--------------|-----------------------
| workerの起動     | なし           | started      | スクリプトのエラーなど
| workerの停止     | terminate      | terminated   |
| 強制activate     | activate       | activated    | error
| 強制deactivate   | deactivate     | deactivated  | error
| 状態の報告       | status         | report       |
| expressへの応答  | --             | activated    | deactivated



## workerとのboradcastMessagingインタフェース

onMessageとは別にworkerはbroadcastChannelを利用する。こちらは
会話を行うための通信である。

| type  | 親:メッセージ | worker:成功時の応答 | worker:失敗時の応答
|-------|---------------|---------------------|--------------------
| 入力  | impress       | propose             | propose
| 発言  | express       | render              | 


*/

import BotIO from './botIo';

export class Biomebot {

    constructor(){
        this.botIo = new BotIO();
        this.workerPool = {};
    }

    /**
    * 全てのスクリプトがindexedDBにアップロードされている状態にする
    * @param {*} snap graphqlのsnapshot 
    */
    async startup(snap){
        // 全てのスクリプトがindexedDBにアップロードされている状態にする
        await this.botIo.syncOrigin(snap);
        await this.botIo.syncGained();

        // botModulesの全リスト生成
        for(let node of snap.data.allPlainText.nodes){
            const p = node.parent;
            const botId = p.relativeDirectory;
            if (p.ext === ".concept" || p.ext === ".sequence"){
                if (!(botId in this.workerPool)){
                    this.workerPool[botId] = []
                }
                this.workerPool[botId][p.name]={
                    worker:None,
                    type: p.ext
                    
                }
            }
        }
    }

    /**
     * 全モジュールの状態を返す
     */
    status(){
        let report = [];
        for(let botId in this.workerPool){
            let wp = this.workerPool[botId];
            for(let moduleName in wp){
                let worker = wp[moduleName].worker;
                if(!worker){
                    report.push({
                        botId: botId,
                        moduleName: moduleName,
                        type: worker.type,
                        status: worker ? worker.status() : "not started"
                    })
                }
            }

        }

        return report;
    }
}
