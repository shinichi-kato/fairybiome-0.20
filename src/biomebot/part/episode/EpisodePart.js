import { Part } from './Part';
import { EpisodeStorage } from '../../../EpisodeStorage';

class EpisodePart extends Part {
  constructor(botName, partName) {
    super(botName, partName);
    this.engineName = "Episode"
    const firestoreToken = "dummy"
    this.engine = new EpisodeStorage(firestoreToken);

    this._broadcastChannel.addEventListener('message', (event) => this._messageListener(event));
  }

  async deploy() {
    return await this.engine.deploy(this.botName, this.partName)
  }

  report() {
    return "report: 未実装"
  }

  _messageListener(event) {
    // broadcast channelから
    // type: ""
  }
}