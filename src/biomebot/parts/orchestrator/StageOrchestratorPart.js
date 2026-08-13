import { type } from 'node:os';
import { Part } from '../part.js';

export class OrchestratorPart extends Part {
  constructor() {
    this.botName = "";
    this.partName = "";
    this.state = "starting";
    this.firestoreToken = null;
    this.engineName = "orchestrator";
    this.messages = [];
    this.worker = null;
    this.broadcastChannel = null;
  }

  init(botName, partName, worker,boradcastChannel, firestoreToken = null) {
    this.botName = botName;
    this.partName = partName;
    this.firestoreToken = firestoreToken;
    this.state = "starting";
    this.worker = worker;
    this.broadcastChannel = boradcastChannel;
  }

  // Orchestratorのdeploy
  async deploy() {
    const path = `static/bots/${this.botName}/${this.partName}.json`;
    let response;

    try {
      response = await fetch(path);
    } catch (err) {
      console.warn(`failed to fetch "${path}"`, err);
      return;
    }

    if (!response.ok) {
      console.warn(`failed to load "${path}" (${response.status})`);
      return;
    }

    let data;
    try {
      data = await response.json();
    } catch (err) {
      console.warn(`failed to parse JSON in "${path}"`, err);
      return;
    }
    const factor = data?.factor ?? {};
    const intervals = factor.intervals_msec ?? factor.intervals ?? [300, 200, 250];
    this.factor = { ...factor, intervals_msec: intervals, attenuation: factor.attenuation ?? 0.7 };
    this.botDisplayName = data?.botDisplayName ?? this.botName;
    this.deploy0();
    return
  }

  report() {

  }

  // チャットボットの未登場<-> 登場状態管理
  deploy0() {
    this.worker.postMessage({ type: "deactivate", excludedPartNames: ["orchestrator"] });
    this.worker.postMessage({ type: "activate", partNames: ["offstage.episode"] });
    this.state = "polling0";
  }

  polling0() {
    const intervals = this.factor?.intervals_msec ?? this.factor?.intervals ?? [300, 200, 250];
    const interv = intervals[Math.floor(Math.random() * intervals.length)];
    setTimeout(() => {
      this.integrate0();
    }, interv);
  }

  // 受け取ったメッセージを常に蓄積
  acceptMessage(message) {
    this.messages.push(message);
  }

  integrate0() {
    if (this.messages.length === 0) {
      this.polling0();
      return;
    }
    
    // {ONSTAGE}という文字列があったら削除して出力し
    // deploy1に遷移
    for(let m of this.messages){
      
    }
    
  }

  deploy1(){
    this.worker.postMessage({ type: "deactivate", excludedPartNames: ["orchestrator"] });
    this.worker.postMessage({ type: "activate", partNames: ["offstage.episode"] });
    this.state = "polling1";
  }

  polling1() {
    const intervals = this.factor?.intervals_msec ?? this.factor?.intervals ?? [300, 200, 250];
    const interv = intervals[Math.floor(Math.random() * intervals.length)];
    setTimeout(() => {
      this.integrate1();
    }, interv);
  }

  integrate1() {
    // メッセージ中のscoreを比べ、最も大きいものを採用。
    // this.messagesを空にする
    if (this.messages.length === 0) {
      this.polling1();
      return;
    }
    // {OFFSTAGE}という文字列があったらdeploy0に遷移
  }

}