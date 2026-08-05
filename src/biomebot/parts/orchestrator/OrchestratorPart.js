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
  }

  init(botName, partName, firestoreToken = null) {
    this.botName = botName;
    this.partName = partName;
    this.firestoreToken = firestoreToken;
    this.state = "starting";
  }

  // Orchestratorのdeploy
  async deploy(kernelPostMessage, broadcastChannel) {
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
    this.factor = data?.factor ?? { intervals: [300, 200, 250], attenuation: 0.7 };
    this.botDisplayName = data?.botDisplayName ?? this.botName;

    return
  }

  report() {

  }

  // チャットボットの未登場<-> 登場状態管理
  deploy0(kernelPostMessage) {
    kernelPostMessage({ type: "deactivate", excludedPartNames: ["orchestrator"] });
    kernelPostMessage({ type: "activate", partNames: ["offstage.episode"] });
    this.state = "polling0";
  }

  polling0(broadcastChannel) {
    const interv = this.factor.intervals[Math.floor(Math.random() * this.factor.intervals.length)];
    setTimeout(() => {
      this.integrate0(broadcastChannel);
    }, interv);
  }

  // 受け取ったメッセージを常に蓄積
  acceptMessage(message) {
    this.messages.push(message);
  }

  integrate0(broadcastChannel) {
    if (this.messages.length === 0) {
      this.polling0(broadcastChannel);
      return;
    }
    
    const message = this.messages.shift();
    const reply = this.engine.retrieveNotOnStage(message);
  }

}