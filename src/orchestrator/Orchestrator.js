export class Orchestrator {
  constructor(options = {}) {
    this.fetchImpl = options.fetchImpl ?? fetch.bind(globalThis);
    this.config = options.config ?? null;
    this.state = 'starting';
    this.botName = null;
    this.firestoreToken = null;
    this.notOnStageData = null;
    this.notFoundData = null;
    this.factor = { intervals: [300, 200, 250], attenuation: 0.7 };
    this.lastReply = null;
  }

  async deployNotOnStage(botName, firestoreToken) {
    this.botName = botName;
    this.firestoreToken = firestoreToken;

    const response = await this.fetchImpl(`static/bots/${botName}/orchestrator.json`);
    if (!response?.ok) {
      throw new Error(`orchestrator config not found for ${botName}`);
    }

    const data = await response.json();
    this.config = data;
    this.factor = data?.factor ?? this.factor;
    this.notOnStageData = data?.notOnStage ?? null;
    this.notFoundData = data?.notFound ?? null;
    this.state = 'standBy';
    return { state: this.state, botName, firestoreToken };
  }

  retrieveNotOnStage(message) {
    return this._retrieveFromTemplate(this.notOnStageData, message);
  }

  retrieveNotFound(message) {
    return this._retrieveFromTemplate(this.notFoundData, message);
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

  _retrieveFromTemplate(template, message) {
    if (!template || !Array.isArray(template.data) || !Array.isArray(template.columns)) {
      return { text: '', role: 'bot' };
    }

    const text = this._pickTemplateRow(template, message);
    return {
      role: 'bot',
      text: this._normalizeControlTokens(text),
      message,
    };
  }

  _pickTemplateRow(template, message) {
    const rows = template.data || [];
    const fallback = rows[1] ?? rows[0] ?? [];
    const inputText = String(message?.text ?? '').trim();

    if (!inputText) {
      return fallback[1] ?? '';
    }

    const matchedIndex = rows.findIndex((row) => Array.isArray(row) && row[0] === 'user' && String(row[1] ?? '').includes(inputText));
    if (matchedIndex >= 0) {
      const replyRow = rows.find((row, index) => index > matchedIndex && Array.isArray(row) && row[0] === 'bot');
      return replyRow?.[1] ?? fallback[1] ?? '';
    }

    const botRow = rows.find((row) => Array.isArray(row) && row[0] === 'bot');
    return botRow?.[1] ?? fallback[1] ?? '';
  }

  _buildFallbackReply() {
    const fallback = this.retrieveNotFound({ text: '' });
    return {
      role: 'bot',
      text: fallback.text || 'うーん',
      score: 0,
      source: 'notFound',
    };
  }

  _normalizeControlTokens(text) {
    return String(text ?? '')
      .replaceAll('{START}', '')
      .replaceAll('{BYE}', '')
      .replaceAll('{SILENCE}', '')
      .trim();
  }
}
