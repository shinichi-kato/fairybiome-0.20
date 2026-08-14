import { Part } from '../part.js';
import { Message } from '../../../Message.js';
import { EpisodeStorage } from '../../../EpisodeStorage/EpisodeStorage.js';

export class EpisodePart extends Part {
  constructor() {
    super();
    this.engineName = 'Episode';
    this.engine = new EpisodeStorage('dummy');
    this.columns = [];
    this.data = [];
    this.factor = {};
  }

  async init(botName, partName, firestoreToken = null) {
    const data = await this._init(botName, partName, firestoreToken);
    if (!data || typeof data !== 'object') {
      return false;
    }

    this.botName = botName;
    this.partName = partName;
    this.firestoreToken = firestoreToken;
    this.columns = Array.isArray(data.columns) ? [...data.columns] : [];
    this.data = Array.isArray(data.data) ? [...data.data] : [];
    this.factor = { ...(data.factor ?? {}) };

    return true;
  }

  async deploy() {
    if (!this.botName || !this.partName) {
      return false;
    }
    return await this.engine.deploy(this.botName, this.partName);
  }

  report() {
    return {
      status: 'ok',
      botName: this.botName,
      partName: this.partName,
      engine: this.engineName,
      factor: this.factor,
      columns: this.columns,
    };
  }

  receive(message) {
    if (!this.engine || typeof this.engine.retrieve !== 'function') {
      return { status: 'error', message: 'engine not ready' };
    }
    return this.engine.retrieve(message);
  }

  input(message) {
    const result = this.receive(message);
    if (!result || result.status === 'error') {
      return [];
    }

    const row = Array.isArray(result.row) ? result.row : [];
    if (!row.length) {
      return [];
    }

    return [new Message({
      role: 'bot',
      text: row[1] ?? '',
      target: 'other',
      timestamp: new Date().toISOString(),
      emo: '',
      facing: 'face',
      location: 'private',
      ecoState: '',
      displayName: this.partName,
      backgroundColor: '',
      props: {
        botName: this.botName,
        partNames: [this.partName],
        score: typeof result.score === 'number' ? result.score : 0,
      },
    })];
  }

  inputInnerSpeech(message) {
    return this.input(message);
  }

  getOutput(message) {
    return message ?? null;
  }
}

export default EpisodePart;