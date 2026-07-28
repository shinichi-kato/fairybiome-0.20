import EpisodeStorage from '../EpisodeStorage';

export class Orchestrator {
  constructor(firestoreToken) {
    this.fetchImpl = options.fetchImpl ?? fetch.bind(globalThis);
    this.config = options.config ?? null;
    this.state = 'starting';
    this.botName = null;
    this.firestoreToken = firestoreToken;
    this.notOnStage = new EpisodeStorage(firestoreToken);
    this.notFound = new EpisodeStorage(firestoreToken);
    this.factor = { intervals: [300, 200, 250], attenuation: 0.7 };
    this.lastReply = null;
  }

  async deploy(botName, partName) {
    this.botName = botName;
    this.partName = partName;
    const response = await this.fetchImpl(`static/bots/${botName}/${partName}.json`);
    if (!response?.ok) {
      throw new Error(`orchestrator config not found for ${botName}`);
    }

    const data = await response.json();
    this.notOnStage.deploy(this.botName, "notOnStage", data.notOnStage);
    this.notFound.deploy(this.botName, "notFound", data.notFound);
    this.factor = data?.factor ?? this.factor;
    this.config = data;
    this.state = 'standBy';
    return { state: this.state, botName, firestoreToken };
  }
 
  retrieveNotOnStage(message) {
    let reply = this.notOnStage.retrieve(message);
    return reply;
  }

  retrieveNotFound(message) {
    return this.notFound.retrieve(message);
  }

  reply(messages = []) {
    const normalized = Array.isArray(messages) ? messages : [];
    if (normalized.length === 0) {
      return this._buildFallbackReply();
    }

    const ranked = normalized
      .map((entry, index) => ({
        ...entry,
        score: Number(entry?.score ?? 0) * Math.pow(this.factor?.attenuation ?? 0.7, index + 1),
      }))
      .sort((a, b) => b.score - a.score);

    const best = ranked[0];
    if (!best) {
      return this._buildFallbackReply();
    }

    const text = this._normalizeControlTokens(best.text ?? '');
    this.lastReply = { ...best, text, score: best.score };
    return this.lastReply;
  }

}
