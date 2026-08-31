/*
Biomebot Kernel
===============
使用法:
```
const botPaths = $ENV.NEXT_PUBLIC_STATIC_FILES.bots[botName];
const biomebot = new Biomebot(botPaths);
biomebot.replyCallbackFunction = (botName, message) => {
  // handle output from bot
};

await biomebot.activate({ botName, partNames: ["orchestrator"] });
await biomebot.input(botName, message);
```

## 概要
* UIからinput()関数を利用してユーザ発言や環境の情報を受け取る。
* 受け取ったメッセージに含まれるユーザ名やチャットボットの名称を
  タグ化し、全パートにbroadcastする。
* パート管理（activate/deactivate/report)
* パートから生成されたoutputを受取り、タグをdecodeしてUIに返す。
* messageをpartに配信したら、outputが送られてくるまで次の
  messageは投入しない。output待機中に次のmessageを受け取ったら
  this.inputQueueに蓄積し、outputが解除されたらqueueに残ったmessageをpartに
  配信する。

*/
const workerRoot="/src/biomebot/parts";

// ファイル名で起動するworkerを切り替える
const workerURL = {
  "episode": `${workerRoot}/episode/EpisodePart.worker.js`,
  "orchestator": `${workerRoot}/orchestrator/OrcehstratorPart.worker.js`,
  "stageOrchestrator": `${workerRoot}/orchestrator/StageOrchestratorPart.worker.js`,
}

export class Biomebot {
  /*
  botPaths = {[botName]:[partPaths],...}というmapを渡す
  */
  constructor(paths) {
    this.timeout = options.timeout ?? 3000;
    this.staticPaths = { ...paths };
    this.botPartMap = null;
    this.tagPaths = {};

    this._generatePathDict(this.staticPaths);
    this.parts = initializeParts(this.botPartMap); //{partName: {state, worker}}
    this.botStates = initializeBotStates(this.botPartMap);
    this.replyCallbackFunction = null;
    this.broadcastChannels = new Map();
    this.inputQueue = {};
    this.tags = {}
  }

  log(message) {
    console.log(message);
  }

  /*
    botPaths={[botName]:[paths]}を与える。
    * pathsには
      '/static/bots/Aurula/greeting.episode.json',
      '/static/bots/Aurula/myfavorite.concept.json',
      '/static/bots/Aurula/main.tags.json'などが格納される。
  
    * パス末尾の'json'を拡張子、その前の'episode'の部分をsuffixと呼ぶ
  
    1. this.bots={[botName]:[partName,...],...}を生成。
      - partNameは"greeting.episode"のようにファイル名から末尾の".json"を
        除去したもの。
      - partとして有効なのはsuffixが
        orchestrator, stageOrchestrator, episode, conceptのいずれか
  
    2. this.tags={[botName]:[path,...]}を生成。
     効なのはsuffixが'tags'であるもの
  */
  _generatePathDict(botPaths) {
    const validParts = ['episode', 'concept', 'orchestrator','stageOrchestrator'];

    for (const botName in botPaths) {
      this.botPartMap[botName] = [];
      this.tagPaths[botName] = [];

      const targets = botPaths[botName].filter(path =>
        path.endsWith('.json')
      );

      for (const path of targets) {
        const filename = path.split('/').pop(); // greeting.episode.json

        const partName = filename.replace(/\.json$/, '');
        const suffix = partName.split('.').pop();

        if (validParts.includes(suffix)) {
          this.botPartMap[botName].push(partName);
        }

        if (suffix === 'tags') {
          this.tagPaths[botName].push(path);
        }
      }
    }
  }

  /*
  partsの初期状態として、{partName: {state:"idle", worker: null}}を生成
  */
  initializeParts(bots) {
    const parts = new Map();
    for (const botName in bots) {
      for (const partName in bots[botName]) {
        const partId = `${botName}:${partName}`;
        if (!parts.has(partId)) {
          parts.set(partId, { state: 'idle', worker: null });
        }
      }
    }
    return parts;
  }

  /*
  botStatesの初期状態として、{botName: {partName: "idle"}}を生成
  */
  initializeBotStates(bots) {
    const botStates = {};
    for (const botName in bots) {
      botStates[botName] = {
        null: {
          isWaitingForOutput: false,
          inputQueue: [],
        },
      };
      for (const partName in bots[botName]) {
        botStates[botName][partName] = 'idle';
      }
    }
    return botStates;
  }

  _ensureInputState(botName) {
    const botState = this.botStates?.[botName];
    if (!botState) {
      return null;
    }

    if (!botState[null]) {
      botState[null] = {
        isWaitingForOutput: false,
        inputQueue: [],
      };
    }

    return botState[null];
  }
  /* ------------------------------------------------------

  UIとの通信
  UIおよび環境からbiomebotにmessageを送る：input(message)
  biomebotからUIにmessageを送る: replyCallbackFunctionを設定

  ----------------------------------------------------------
  */
  async input(botName, message) {
    // inputされたメッセージをpartに配信したら、partからoutputが
    // 送られてくるまで次のinputをpartに送らない。
    const globalState = this._ensureInputState(botName);
    if (!globalState) {
      throw new Error(`${botName} is not initialized`);
    }

    if (globalState.isWaitingForOutput) {
      globalState.inputQueue.push(message);
      return;
    }

    globalState.isWaitingForOutput = true;

    if (this.broadcastChannels.has(botName)) {
      const channel = this.broadcastChannels.get(botName);
      channel.postMessage({ 
        type: 'input', 
        message: this._encodeTags(botName, message) });
    } else {
      globalState.isWaitingForOutput = false;
      throw new Error(`${botName} not deployed`);
    }
  }

  _flushInputQueue(botName) {
    const globalState = this._ensureInputState(botName);
    if (!globalState) {
      return;
    }

    const { inputQueue, isWaitingForOutput } = globalState;
    if (isWaitingForOutput || inputQueue.length === 0) {
      return;
    }

    const next = inputQueue.shift();
    if (!next) {
      return;
    }

    if (this.broadcastChannels.has(botName)) {
      const channel = this.broadcastChannels.get(botName);
      channel.postMessage({
        type: 'input',
        message: this._encodeTags(botName, next),
      });
      globalState.isWaitingForOutput = true;
    }
  }
  set replyCallbackFunction(func) {
    this._replyCallbackFunction = func;
  }

  /*　------------------------------------------------------
  
  partとの通信

  ----------------------------------------------------------
  
  partNamesに指定されたパートを有効化する。
  excludePartNamesに指定されたパートは有効化も無効化もしない。
  どちらも指定されなければ、botNameに紐づく全てのパートを有効化する。
  */
  async activate(request) {
    const { 
      botName, 
      partNames=[...this.botPartMap[botName]],
      excludedPartNames =[]
    } = request;

    if (!(botName in this.botPartMap)) {
      throw new Error(`invalid botName ${botName}`);
    }
    const botState = this.botStates[botName];

    const targetPartNames = partNames.filter(
      partName => { !excludedPartNames.includes(partName) && partName in this.botPartMap[botName] });
    // Process all parts in parallel
    const promises = targetPartNames.map(async (partName) => {
      const partId = `${botName}:${partName}`;
      const failedParts = [];
      const activatedParts = [];

      const part = this.parts.get(partId);

      if (!part) {
        failedParts.push({
          partName,
          error: 'Part not found',
          timestamp: Date.now(),
        });
        return;
      }

      try {
        // Deploy if not deployed
        if (part.state === 'idle') {
          await this._deployPart(botName, partName);
          this._loadTags(botName);
          this.broadcastChannels.set(botName, new BroadcastChannel(`biomebot-${botName}`));
        }

        // Send activate message and wait for response with timeout
        part.state = 'deploying';
        this._sendToWorkerChannel(botName, partName, { type: 'activate' });

        try {
          await this._waitForPartResponse(botName, partName, 'activated', this.timeout);
          part.state = 'active';
          activatedParts.push(partName);
          botState.activePartCount++;
        } catch (error) {
          part.state = 'failed';
          part.errors.push(String(error));
          failedParts.push({
            partName,
            error: String(error),
            timestamp: Date.now(),
          });
        }
      } catch (error) {
        part.state = 'failed';
        part.errors.push(String(error));
        failedParts.push({
          partName,
          error: String(error),
          timestamp: Date.now(),
        });
      }
    });

    await Promise.all(promises);

    const response = {
      type: 'activateCompleted',
      botName,
      activatedParts,
      failedParts,
    };

    this.log(`Activate completed: ${activatedParts.length} success, ${failedParts.length} failed`);
    this._broadcastCompletion(response);
    return response;
  }

  async deactivate(request) {
    const { 
      botName, 
      partNames=[...this.botPartMap[botName]],
      excludedPartNames =[]
    } = request;

    if (!(botName in this.botPartMap)) {
      throw new Error(`invalid botName ${botName}`);
    }

    const deactivatedParts = [];
    const failedParts = [];
    const botState = this.botStates[botName];
    const targetPartNames = partNames.filter(
      partName => { !excludedPartNames.includes(partName) && partName in this.botPartMap[botName] });

    const promises = targetPartNames.map(async (partName) => {
      const partId = `${botName}:${partName}`;
      const part = this.parts.get(partId);
      if (!part || part.state === 'idle') {
        return; // Skip idle parts
      }

      try {
        part.state = 'deactivating';
        this.part.worker.postMessage({ type: 'deactivate' });

        try {
          await this._waitForPartResponse(botName, partName, 'deactivated', this.timeout);
          part.state = 'deactivated';
          deactivatedParts.push(partName);
          botState.activePartCount--;
        } catch (error) {
          part.state = 'failed';
          part.errors.push(String(error));
          failedParts.push({
            partName,
            error: String(error),
            timestamp: Date.now(),
          });
        }
      } catch (error) {
        part.state = 'failed';
        part.errors.push(String(error));
        failedParts.push({
          partName,
          error: String(error),
          timestamp: Date.now(),
        });
      }
    });

    await Promise.all(promises);

    const response = {
      type: 'deactivateCompleted',
      botName,
      deactivatedParts,
      failedParts,
    };

    this.log(`Deactivate completed: ${deactivatedParts.length} success, ${failedParts.length} failed`);
    this._broadcastCompletion(response);
    return response;
  }

  /**
   * Report status of specified parts
   */
  async report(request) {
    const { botName, partNames } = request;
    this.log(`Reporting bot: ${botName}, parts: ${partNames?.join(',') ?? 'all'}`);

    const botState = this.botPartMap.get(botName);
    if (!botState) {
      return {
        type: 'reportCompleted',
        botName,
        reports: {},
        failedParts: [{ partName: 'all', error: 'Bot not initialized', timestamp: Date.now() }],
      };
    }

    const targetPartNames = partNames ?? Array.from(botState.parts.keys());
    const reports = {};
    const failedParts = [];

    // Process all parts in parallel
    const promises = targetPartNames.map(async (partName) => {
      const partId = `${botName}:${partName}`;
      const part = this.partCache.get(partId);

      if (!part) {
        failedParts.push({
          partName,
          error: 'Part not found',
          timestamp: Date.now(),
        });
        return;
      }

      try {
        this._sendToWorkerChannel(botName, partName, { type: 'report' });

        try {
          await this._waitForPartResponse(botName, partName, 'reported', this.timeout);
          // Response is stored in part state, retrieve it here
          reports[partName] = {
            state: part.state,
            deployedAt: part.deployedAt,
          };
        } catch (error) {
          failedParts.push({
            partName,
            error: String(error),
            timestamp: Date.now(),
          });
        }
      } catch (error) {
        failedParts.push({
          partName,
          error: String(error),
          timestamp: Date.now(),
        });
      }
    });

    await Promise.all(promises);

    const response = {
      type: 'reportCompleted',
      botName,
      reports,
      failedParts,
    };

    this.log(`Report completed: ${Object.keys(reports).length} success, ${failedParts.length} failed`);
    this._broadcastCompletion(response);
    return response;
  }

  /**
   * Shutdown a bot and cleanup resources
   */
  async shutdown(botName) {
    this.log(`Shutting down bot: ${botName}`);

    // Deactivate all parts
    await this.deactivate({
      type: 'deactivate',
      botName,
    });

    // Clear bot state
    const botState = this.botPartMap.get(botName);
    if (botState) {
      botState.parts.clear();
      this.botPartMap.delete(botName);
    }

    // Clear part cache for this bot and close workerChannels
    for (const [partId, part] of this.partCache) {
      if (partId.startsWith(`${botName}:`)) {
        if (part.workerChannel) {
          part.workerChannel.close();
        }
        this.partCache.delete(partId);
      }
    }

    this.log(`Bot ${botName} shutdown complete`);
  }

  /**
 * Wait for a response from a worker part
 */
  _waitForPartResponse(
    botName,
    partName,
    expectedType,
    timeout
  ) {
    const waiterId = `${botName}:${partName}:${expectedType}`;

    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.responseWaiters.delete(waiterId);
        const error = `timeout waiting for ${expectedType} from ${partName}`;
        this.log(`⚠ ${error}`);
        reject(new Error(error));
      }, timeout);

      this.responseWaiters.set(waiterId, { resolve, reject, timeoutId });
    });
  }

  async _deployPart(botName, partName) {
    const partId = `${botName}:${partName}`;
    const part = this.parts.get(partId);
    if (!part) {
      throw new Error(`Part ${partName} not found for bot ${botName}`);
    }
    if (part.state === 'blank') {
      const jsonPath = this.botPartMap[botName][partName];
      const botType = partName.split('.').pop();
      const worker = new Worker(workerURL[botType]);

      part.worker = worker;
      part.state = 'deploying';
      part.deployedAt = Date.now();
      part.worker.postMessage({ type: "init", botName, partName });
      part.worker.onmessage = (e) => {
        const event = e.data;
        switch (event.type) {
          case 'initialized':
            part.state = 'idle';
            this.log(`Part ${partName} initialized for bot ${botName}`);
            break;
          case 'deployed':
            part.state = 'deployed';
            this.log(`Part ${partName} deployed for bot ${botName}`);
            break;
          case 'activated':
            part.state = 'active';
            this.log(`Part ${partName} activated for bot ${botName}`);
            break;
          case 'deactivated':
            part.state = 'idle';
            this.log(`Part ${partName} deactivated for bot ${botName}`);
            break;
          case 'reported':
            // Handle report response if needed
            break;
          case 'activate':
            // activation request by orchestraotor part  
            this.activate({
              botName: event.botName,
              partNames: event.partNames,
              excludedPartNames: event.excludedPartNames
            });
            break;
          case 'deactivate':
            // deactivation request by orchestraotor part
            this.deactivate({
              botName: event.botName,
              partNames: event.partNames,
              excludedPartNames: event.excludedPartNames
            });
            break;
          case 'output': {
            // orchestrator only emits final output; other parts emit innerVoice.
            const botName = event.botName;
            const botState = this.botStates?.[botName];
            if (botState?.[null]) {
              botState[null].isWaitingForOutput = false;
            }

            const m = {
              ...event.message,
              text: this._decodeTags(event.botName, event.message?.text ?? '')
            }
            this._replyCallbackFunction?.(
              event.botName, m);

            this._flushInputQueue(botName);
            break;
          }
          default:
            this.log(`Unknown message type from part ${partName}: ${event.type}`);
        }
      }
    }
  }

  /**
   * タグ定義JSONを読み込み、
   * this.tags[botName] = {
   *   encode: { surface: tag },
   *   decode: { tag: [surface1, ...] },
   *   surfaces: [surface, ...] // 長い順
   * }
   * を生成する。
   */
  async _loadTags(botName) {
    const encode = {};
    const decode = {};

    const paths = this.tagPaths[botName] || [];

    for (const path of paths) {
      const res = await fetch(path);

      if (!res.ok) {
        console.warn(`Failed to load tag file: ${path}`);
        continue;
      }

      const json = await res.json();

      if (!Array.isArray(json.tags)) {
        continue;
      }

      for (const tagObj of json.tags) {
        for (const [tag, surfaces] of Object.entries(tagObj)) {
          if (!Array.isArray(surfaces)) {
            continue;
          }

          decode[tag] ??= [];

          for (const surface of surfaces) {
            encode[surface] = tag;
            decode[tag].push(surface);
          }
        }
      }
    }

    const sortedSurfaces = Object.keys(encode)
      .sort((a, b) => b.length - a.length);

    this.tags ??= {};
    this.tags[botName] = {
      encode,
      decode,
      surfaces: sortedSurfaces,
      tagNames: {}
    };
  }


  /*
   * this.tags[botName].encode = { surface: tag }
   * を利用して、text中のsurfaceをtagに置換する。
   *
   * 置換に使われたsurfaceは、
   * this.tags[botName].tagNames[tag] に保存する。
   */
  _encodeTags(botName, message) {
    const tags = this.tags?.[botName];

    if (!tags) {
      return text;
    }

    let result = text;

    // ユーザ名はmessageから取得
    const dname = message.displayName;
    if(result.includes(dname)){
      tags.tagNmaes["{user}"] = dname;
      result = result.replaceAll(dname,"{user}");
    }

    for (const surface of tags.surfaces) {
      if (!result.includes(surface)) {
        continue;
      }

      const tag = tags.encode[surface];

      // 直近で使われたsurfaceとして記録する
      tags.tagNames[tag] = surface;

      result = result.replaceAll(surface, tag);
    }

    return result;
  }

  /*
 * this.tags[botName].decode = { tag: [surface1, surface2, ...] }
 * と
 * this.tags[botName].tagNames = { tag: surface }
 * を利用して、text中のtagをsurfaceに戻す。
 */
  _decodeTags(botName, text) {
    const tags = this.tags?.[botName];

    if (!tags) {
      return text;
    }

    let result = text;

    const tagList = Object.keys(tags.decode)
      .sort((a, b) => b.length - a.length);

    for (const tag of tagList) {
      const surface =
        tags.tagNames[tag] ??
        tags.decode[tag]?.[0];

      if (!surface) {
        continue;
      }

      result = result.replaceAll(tag, surface);
    }

    return result;
  }
}

const DEFAULT_CHAT_BACKGROUND_COLOR = '#DDDDDD';

function readBotAvatarDirs() {
  try {
    const configured = process.env.NEXT_PUBLIC_BOT_AVATAR_DIRS;
    return configured ? JSON.parse(configured) : {};
  } catch {
    return {};
  }
}

function toPartName(path) {
  return path.replace(/\\/g, '/').split('/').pop()?.replace(/\.json$/, '') ?? '';
}

/**
 * Browser client for the ChatUI lifecycle. It is isolated from the legacy
 * Biomebot API until the remaining part protocol has been migrated.
 */
export class ChatBiomebot {
  constructor(botPaths = {}) {
    this.botPaths = botPaths;
    this.broadcastChannels = new Map();
    this.botWorkers = new Map();
    this.botStates = new Map();
    this.avatarDirs = readBotAvatarDirs();
    this.replyCallbackFunction = null;
  }

  async deploy(botName) {
    const paths = this.botPaths[botName];
    if (!Array.isArray(paths)) {
      throw new Error(`invalid botName ${botName}`);
    }

    if (!this.broadcastChannels.has(botName)) {
      console.log(`[ChatBiomebot] Starting ${botName}`);
      const channel = new BroadcastChannel(`biomebot-${botName}`);
      channel.onmessage = event => this._handleBroadcast(botName, event.data);
      this.broadcastChannels.set(botName, channel);
      this.botStates.set(botName, {
        isWaitingForOutput: false,
        inputQueue: [],
        inFlight: null,
        initializedWorkerCount: 0,
        activatedWorkerCount: 0,
        workerCount: paths.length,
      });
      const workers = paths.map(path => this._createWorker(botName, toPartName(path)));
      this.botWorkers.set(botName, workers);
      console.log(`[ChatBiomebot] Started ${botName}`);
    }

    return {
      botName,
      displayName: botName,
      backgroundColor: DEFAULT_CHAT_BACKGROUND_COLOR,
    };
  }

  async input(botName, message) {
    const state = this.botStates.get(botName);
    const channel = this.broadcastChannels.get(botName);
    if (!state || !channel) {
      throw new Error(`${botName} is not deployed`);
    }

    if (state.activatedWorkerCount < state.workerCount || state.isWaitingForOutput) {
      state.inputQueue.push(message);
      return;
    }

    this._sendInput(botName, message);
  }

  async shutdown(botName) {
    for (const worker of this.botWorkers.get(botName) ?? []) {
      worker.postMessage({ type: 'terminate' });
      worker.terminate();
    }
    this.botWorkers.delete(botName);

    this.broadcastChannels.get(botName)?.close();
    this.broadcastChannels.delete(botName);
    this.botStates.delete(botName);
  }

  _createWorker(botName, partName) {
    const workerUrl = partName.includes('orchestrator')
      ? '/biomebot-workers/Orchestrator.worker.js'
      : '/biomebot-workers/EpisodePart.worker.js';
    const worker = new Worker(workerUrl, { type: 'module' });

    let initialized = false;
    worker.onerror = event => {
      console.error(`[ChatBiomebot] Worker error ${botName}:${partName}`, event.message);
    };
    worker.onmessageerror = event => {
      console.error(`[ChatBiomebot] Worker message error ${botName}:${partName}`, event);
    };
    worker.onmessage = event => {
      if (!initialized && event.data?.type === 'initialized') {
        initialized = true;
        console.log(`[ChatBiomebot] Initialized ${botName}:${partName}`);
        worker.postMessage({ type: 'deploy', botName, partName });
        return;
      }

      if (event.data?.type === 'deployed') {
        worker.postMessage({ type: 'activate', botName, partName });
        console.log(`[ChatBiomebot] Deployed ${botName}:${partName}`);
        this._markWorkerInitialized(botName);
        return;
      }

      if (event.data?.type === 'activated') {
        this._markWorkerActivated(botName);
        console.log(`[ChatBiomebot] Activated ${botName}:${partName}`);
      }
    };
    worker.postMessage({ type: 'init', botName, partName });
    return worker;
  }

  _markWorkerInitialized(botName) {
    const state = this.botStates.get(botName);
    if (!state) {
      return;
    }

    state.initializedWorkerCount++;
  }

  _markWorkerActivated(botName) {
    const state = this.botStates.get(botName);
    if (!state) {
      return;
    }

    state.activatedWorkerCount++;
    this._flushInputQueue(botName);
  }

  _sendInput(botName, message) {
    const state = this.botStates.get(botName);
    const channel = this.broadcastChannels.get(botName);
    if (!state || !channel) {
      throw new Error(`${botName} is not deployed`);
    }

    state.isWaitingForOutput = true;
    state.inFlight = message;
    channel.postMessage({ type: 'input', message });
  }

  _flushInputQueue(botName) {
    const state = this.botStates.get(botName);
    if (!state || state.activatedWorkerCount < state.workerCount || state.isWaitingForOutput || state.inputQueue.length === 0) {
      return;
    }

    this._sendInput(botName, state.inputQueue.shift());
  }

  _handleBroadcast(botName, event) {
    if (event?.type !== 'output') {
      return;
    }

    const state = this.botStates.get(botName);
    if (!state) {
      return;
    }

    state.isWaitingForOutput = false;
    const output = event.message;
    if (output?.text) {
      const emo = output.emo || 'neutral';
      this.replyCallbackFunction?.(botName, {
        ...output,
        role: 'bot',
        timestamp: output.timestamp ?? new Date().toISOString(),
        displayName: output.displayName || botName,
        backgroundColor: output.backgroundColor || DEFAULT_CHAT_BACKGROUND_COLOR,
        avatarDir: this.avatarDirs[botName] || botName,
        avatar: emo,
        emo,
        messageId: globalThis.crypto.randomUUID(),
        replyTo: state.inFlight?.messageId,
      });
    }
    state.inFlight = null;
    this._flushInputQueue(botName);
  }
}
