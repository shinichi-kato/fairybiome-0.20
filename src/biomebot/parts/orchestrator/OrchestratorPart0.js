import { Part } from '../part.js';

export class OrchestratorPart extends Part {
  constructor(options = {}) {
    super(options.botName ?? null, options.partName ?? 'orchestrator');
    this.orchestrator = options.orchestrator ?? null;
    this.isWorker = options.isWorker ?? true;
    this.state = 'starting';
    this.botName = options.botName ?? null;
    this.firestoreToken = null;
    this.listeners = new Map();
    this._broadcastChannel = options.broadcastChannel ?? this._broadcastChannel ?? null;
    this._pendingMessages = [];
  }

  init(botName, firestoreToken = null) {
    this.botName = botName;
    this.firestoreToken = firestoreToken;
    this.state = 'starting';
  }

  async deploy0(botName, firestoreToken = null) {
    
  }
  async deploy(botName, firestoreToken = null) {
    this.botName = botName;
    this.firestoreToken = firestoreToken;
    this.state = 'starting';

    if (!this.orchestrator) {
      throw new Error('orchestrator instance is required');
    }

    await this.orchestrator.deployNotOnStage(botName, firestoreToken);
    this.state = 'standBy';
    return { state: this.state };
  }

  receive(message) {
    if (!message || typeof message !== 'object') {
      return null;
    }

    if (this.state === 'standBy') {
      const reply = this.orchestrator.retrieveNotOnStage(message);
      if (String(reply?.text ?? '').includes('{START}')) {
        this.state = 'deploy';
        this.orchestrator.deployNotFound?.();
        this.dispatchEvent('reply', { ...reply, text: reply.text.replace('{START}', '').trim() });
        return { ...reply, text: reply.text.replace('{START}', '').trim() };
      }

      this.dispatchEvent('reply', reply);
      return reply;
    }

    if (this.state === 'ready' || this.state === 'polling') {
      this._pendingMessages.push(message);
      if (this.state === 'ready') {
        this.state = 'polling';
      }
      return null;
    }

    if (this.state === 'deploy') {
      this.state = 'ready';
      return { text: '', role: 'bot' };
    }

    return null;
  }

  reply(messages) {
    const result = this.orchestrator.reply(messages);
    const normalizedText = String(result?.text ?? '').replace('{BYE}', '').trim();
    this.dispatchEvent('reply', { ...result, text: normalizedText });
    if (String(result?.text ?? '').includes('{BYE}')) {
      this.state = 'standBy';
    } else {
      this.state = 'ready';
    }
    return { ...result, text: normalizedText };
  }
}
