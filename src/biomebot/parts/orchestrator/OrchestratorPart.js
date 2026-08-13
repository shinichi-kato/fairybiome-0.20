/*
OrchestratorPart
================
* パートから受け取ったメッセージを蓄積し、定期的にそれらを統合し
  UIに返す。


*/

import { Part } from '../part.js';
import { Message } from '../../../Message.js';

export class OrchestratorPart extends Part {
  constructor() {
    super();
    this.innerSpeechPool = [];
    this.inputQueue = [];
  }

  async init(botName, partName, worker, broadcastChannel, firestoreToken = null) {
    this.botName = botName;
    this.partName = partName;
    this.worker = worker;
    this.broadcastChannel = broadcastChannel;
    this.firestoreToken = firestoreToken;

    const path = `static/bots/${botName}/${partName}.json`;
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
    const intervals = factor.intervals_msec ?? [300];
    this.factor = { ...factor, intervals_msec: intervals };
    return true;
  }
  deploy() {

  }

  /*
  ポーリング中に受信した他のpartからのinnerSpeechを蓄積
  */
  receiveInnerSpeech(message) {
    this.innerSpeechPool.push(new Message(message));
  }

  polling() {
    const intervals = this.factor?.intervals_msec;
    if (!intervals.length) {
      return null;
    }

    const interv = intervals[Math.floor(Math.random() * intervals.length)];

    return new Promise((resolve) => {
      setTimeout(() => {
        const output = this.integrate();
        resolve(output);
      }, interv);
    });
  }

  integrate() {
    const otherCandidates = this.innerSpeechPool
      .filter((message) => message.target === 'other')
      .sort((a, b) => (b.props?.score ?? 0) - (a.props?.score ?? 0))
      .slice(0, 3);

    const selfCandidates = this.innerSpeechPool
      .filter((message) => message.target === 'self')
      .sort((a, b) => (b.props?.score ?? 0) - (a.props?.score ?? 0))
      .slice(0, 3);

    const chosenOther = otherCandidates[0] ?? null;
    const chosenSelf = selfCandidates[0] ?? null;

    const output = this._buildOutput(chosenOther, chosenSelf);

    this.innerSpeechPool = [];
    this.inputQueue = [];

    return output;
  }

  _buildOutput(chosenOther, chosenSelf) {
    if (!chosenOther && !chosenSelf) {
      return {
        type: 'output',
        message: null,
        props: {
          partNames: [],
        },
      };
    }

    const otherScore = chosenOther?.props?.score ?? 0;
    const selfScore = chosenSelf?.props?.score ?? 0;

    const selectedOther = chosenOther ?? null;
    const selectedSelf = chosenSelf ?? null;

    const message = selectedOther ? new Message(selectedOther) : (selectedSelf ? new Message(selectedSelf) : null);
    const allPartNames = [...new Set([
      ...(selectedOther?.props?.partNames ?? []),
      ...(selectedSelf?.props?.partNames ?? []),
    ])];

    if (message && selectedOther && selectedSelf && selfScore > otherScore) {
      message.emo = selectedSelf.emo;
    }

    if (message) {
      message.props = {
        ...message.props,
        partNames: allPartNames,
      };
    }

    return {
      type: 'output',
      message,
      props: {
        partNames: allPartNames,
      },
    };
  }
}
