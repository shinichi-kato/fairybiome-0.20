import { Part } from './Part';
import { EpisodeStorage } from '../../../EpisodeStorage';

class EpisodePart extends Part {
  constructor() {
    super();
    this.engineName = "Episode"
    const firestoreToken = "dummy"
    this.engine = new EpisodeStorage(firestoreToken);
  }

  async deploy() {
    this._broadcastChannel.onmessage
    return await this.engine.deploy(this.botName, this.partName)
  }

  report() {
    return "report: 未実装"
  }

  receive(message) {
    return this.engine.retrieve(message);

  }
}