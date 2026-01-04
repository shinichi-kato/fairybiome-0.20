/*
Biomebot-021
============
一つのチャットボットを構成するworkerの管理

botIdで指定された一つのチャットボットはConceptStore,MemoryStore,DialogStoreに
格納されたデータを利用して会話を実行する。
チャットボットは複数のworkerが競争的に動作して発言を生成しており、
各workerに入力を分配し、返答を収集するのにbotIdごとのBroadcastChannelを
利用する。
Biomebotクラスでは以下の処理を行う。

| 項目                 | 内容
|----------------------|--------------------------------------------
| workerプロセス制御   | workerチャンネルを介し起動・停止などを管理
| 入力情報の分配       | 外部入力を全workerにbroadcast
| 内言の統合と外部出力 | workerからの返答をまとめて外部に出力

*/

// 一つのチャットボットを構成するworkersの管理

import { ConceptStore } from '../conceptStore/conceptStore';
import { MemoryStore } from '../memoryStore/memoryStore';
import { DialogStore } from '../dialogStore/dialogStore';

import ConceptWorker from './worker/concept.worker';

export default class Biomebot {

  constructor(botId, config, concepts, dialogs) {
    this.config = { ...config };
    this.concepts = { ...concepts };
    this.dialogs = { ...dialogs };
    this.botId = botId;
    this.workerPool = {};
    this.conceptStore = new ConceptStore(botId);
    this.dialogStore = new DialogStore(botId);
    this.memoryStore = new MemoryStore(botId);
    this.channel = new BroadcastChannel(`Biomebot-${botId}`)
    this.getStatus = this.getStatus.bind(this);

  }

  async destroy() {
    // workerの停止
    // データの書き戻し？
  }

  /**
   * @returns {botId, modules: [{moduleName:string, status:string}]}}
   */
  getStatus() {
    const report = {
      botId: this.botId,
      workerNames: Object.keys(this.workerPool),
    };
    console.log("report", report)
    return report;
  }

  start() {
    // workerの生成
    for(let moduleName in this.concepts){
      if(!(moduleName in this.workerPool)){
        // データの転送
        // ワーカーの生成
        const worker = new ConceptWorker();
        worker.onmessage = function (event){
          const action = event.data;
          // 生成と削除
        }
        worker.postMessage({type:'init',config:this.config,moduleName:moduleName});
        this.workerPool[moduleName]= worker;

      }
    }

  }
}

