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
*/
export class Biomebot {
  /*
  botPaths = {[botName]:[partPaths],...}というmapを渡す
  */
  constructor(botPaths) {
    this.timeout = options.timeout ?? 3000;
    this.log = [];
    this.botPaths = { ...botPaths };
    this.bots = this._generateBots(this.botPaths);
    this.parts = initializeParts(this.bots); //{partName: {state, worker}}
    this.botStates = initializeBotStates(this.bots);
    this.replyCallbackFunction = null;
    this.broadcastChannels = new Map();
  }



  /*
    botPath={[botName]:[paths]}から
    bots={[botName]:{partName: path,...}}を生成。
    partNameは"greeting.episode"のようにファイル名から末尾の".json"を
    除去したもの
  */
  _generateBots(botPaths) {
    let bots = {};
    for (botName in botPaths) {
      if (!(botName in bots)) {
        bots[botName] = {};
      }

      const targets = botPaths[botName].filter((path) => path.endsWith('.json'));
      for (const path of targets) {
        const partName = path.split('/').pop().replace(/\.json$/, '');
        bots[botName][partName] = path;
      }
      return bots;
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
      botStates[botName] = {};
      for (const partName in bots[botName]) {
        botStates[botName][partName] = 'idle';
      }
    }
    return botStates;
  }
  /* ------------------------------------------------------

  UIとの通信
  UIおよび環境からbiomebotにmessageを送る：input(message)
  biomebotからUIにmessageを送る: replyCallbackFunctionを設定

  ----------------------------------------------------------
  */
  async input(botName, message) {
    if(this.broadcastChannels.has(botName)){
      const channel = this.broadcastChannels.get(botName);
      channel.postMessage({ type: 'input', message });
    } else {
      throw new Error(`${botName} not deployed`);
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
    const { botName, partNames, excludedPartNames } = request;

    if (!(botName in this.bots)) {
      throw new Error(`invalid botName ${botName}`);
    }
    const botState = this.botStates[botName];
    const targetPartNames = partNames.filter(
      partName => { !excludedPartNames.includes(partName) && partName in this.bots[botName] });
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
    const { botName, partNames, excludedPartNames } = request;

    if (!(botName in this.bots)) {
      throw new Error(`invalid botName ${botName}`);
    }

    const deactivatedParts = [];
    const failedParts = [];
    const botState = this.botStates[botName];
    const targetPartNames = partNames.filter(
      partName => { !excludedPartNames.includes(partName) && partName in this.bots[botName] });

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

    const botState = this.bots.get(botName);
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
    const botState = this.bots.get(botName);
    if (botState) {
      botState.parts.clear();
      this.bots.delete(botName);
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
      const partPath = this.bots[botName][partName];
      const worker = new Worker(partPath);
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
            // output request by orchestraotor part
            this._replyCallbackFunction?.(
              event.botName, event.message);
            break;
          }
          default:
            this.log(`Unknown message type from part ${partName}: ${event.type}`);
        }
      }
    }
  }
}
