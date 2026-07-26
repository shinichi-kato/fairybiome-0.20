/**
 * Kernel: Manages multiple chatbot parts (workers) lifecycle and communication
 */

import {
  KernelOptions,
  PartConfig,
  BotState,
  PartInstance,
  PartState,
  KernelRequest,
  ActivateRequest,
  DeactivateRequest,
  ReportRequest,
  ListenRequest,
  ActivateCompleted,
  DeactivateCompleted,
  ReportCompleted,
  BroadcastMessage,
  PartResponse,
  ActivatedResponse,
  DeactivatedResponse,
  ReportedResponse,
  FailedPart,
  ChatMessage,
} from './kernel.types';

export class Kernel {
  private static instance: Kernel | null = null;

  private timeout: number = 3000; // 3 seconds default
  private partConfig: PartConfig = {};
  private bots: Map<string, BotState> = new Map();
  private partCache: Map<string, PartInstance> = new Map();
  private broadcastChannels: Map<string, BroadcastChannel> = new Map(); // パート間通信用
  private debug: boolean = false;

  // Response waiters for worker channel responses (partId -> promise resolver)
  private responseWaiters: Map<string, {
    resolve: () => void;
    reject: (error: Error) => void;
    timeoutId: NodeJS.Timeout;
  }> = new Map();

  constructor(options: KernelOptions = {}) {
    this.timeout = options.timeout ?? 3000;
    this.partConfig = options.partConfig ?? {};
    this.debug = options.debug ?? false;
    this.log('Kernel initialized');
  }

  /**
   * Get singleton instance
   */
  static getInstance(options?: KernelOptions): Kernel {
    if (!Kernel.instance) {
      Kernel.instance = new Kernel(options);
    }
    return Kernel.instance;
  }

  /**
   * Initialize a bot and its parts
   */
  async initialize(botName: string, partNames?: string[]): Promise<void> {
    this.log(`Initializing bot: ${botName}`);

    // Create BroadcastChannel for part-to-part communication in this bot
    const channelName = `biomebot-${botName}`;
    if (!this.broadcastChannels.has(botName)) {
      const channel = new BroadcastChannel(channelName);
      this.broadcastChannels.set(botName, channel);
      // Note: Kernel listens to parts through workerChannel (MessagePort)
      // BroadcastChannel is used for part-to-part communication
    }

    // Initialize bot state
    if (!this.bots.has(botName)) {
      const botState: BotState = {
        botName,
        parts: new Map(),
        broadcastChannel: this.broadcastChannels.get(botName),
        messageQueue: [],
        isProcessing: false,
        activePartCount: 0,
      };
      this.bots.set(botName, botState);
    }

    // Discover parts
    const targetParts = partNames ?? this._discoverParts(botName);
    const botState = this.bots.get(botName)!;

    for (const partName of targetParts) {
      const partId = `${botName}:${partName}`;
      if (!this.partCache.has(partId)) {
        const part: PartInstance = {
          id: partId,
          botName,
          state: 'idle',
          errors: [],
        };
        this.partCache.set(partId, part);
        botState.parts.set(partName, part);
      }
    }

    this.log(`Initialized bot: ${botName} with parts: ${targetParts.join(', ')}`);
  }

  /**
   * Activate specified parts of a bot
   */
  async activate(request: ActivateRequest): Promise<ActivateCompleted> {
    const { botName, partNames, excludedPartNames } = request;
    this.log(`Activating bot: ${botName}, parts: ${partNames?.join(',') ?? 'all'}`);

    // Initialize if needed
    if (!this.bots.has(botName)) {
      await this.initialize(botName, partNames);
    }

    const botState = this.bots.get(botName)!;
    const targetPartNames = this._resolvePartNames(botName, partNames, excludedPartNames);

    const activatedParts: string[] = [];
    const failedParts: FailedPart[] = [];

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
        // Deploy if not deployed
        if (part.state === 'idle') {
          await this._deployPart(botName, partName);
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

    const response: ActivateCompleted = {
      type: 'activateCompleted',
      botName,
      activatedParts,
      failedParts,
    };

    this.log(`Activate completed: ${activatedParts.length} success, ${failedParts.length} failed`);
    this._broadcastCompletion(response);
    return response;
  }

  /**
   * Deactivate specified parts of a bot
   */
  async deactivate(request: DeactivateRequest): Promise<DeactivateCompleted> {
    const { botName, partNames, excludedPartNames } = request;
    this.log(`Deactivating bot: ${botName}, parts: ${partNames?.join(',') ?? 'all'}`);

    const botState = this.bots.get(botName);
    if (!botState) {
      return {
        type: 'deactivateCompleted',
        botName,
        deactivatedParts: [],
        failedParts: [{ partName: 'all', error: 'Bot not initialized', timestamp: Date.now() }],
      };
    }

    const targetPartNames = this._resolvePartNames(botName, partNames, excludedPartNames);

    const deactivatedParts: string[] = [];
    const failedParts: FailedPart[] = [];

    // Process all parts in parallel
    const promises = targetPartNames.map(async (partName) => {
      const partId = `${botName}:${partName}`;
      const part = this.partCache.get(partId);

      if (!part || part.state === 'idle') {
        return; // Skip idle parts
      }

      try {
        part.state = 'deactivating';
        this._sendToWorkerChannel(botName, partName, { type: 'deactivate' });

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

    const response: DeactivateCompleted = {
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
  async report(request: ReportRequest): Promise<ReportCompleted> {
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
    const reports: Record<string, unknown> = {};
    const failedParts: FailedPart[] = [];

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

    const response: ReportCompleted = {
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
   * Listen and queue messages for a bot
   */
  async listen(request: ListenRequest): Promise<void> {
    const { botName, message } = request;
    this.log(`Listen: bot=${botName}, message=${message.text}`);

    const botState = this.bots.get(botName);
    if (!botState) {
      this.log(`Bot ${botName} not initialized, initializing...`);
      await this.initialize(botName);
    }

    const state = this.bots.get(botName)!;
    state.messageQueue.push(message);

    // Batch messages and broadcast
    this._flushMessageQueue(botName);
  }

  /**
   * Shutdown a bot and cleanup resources
   */
  async shutdown(botName: string): Promise<void> {
    this.log(`Shutting down bot: ${botName}`);

    // Deactivate all parts
    await this.deactivate({
      type: 'deactivate',
      botName,
    });

    // Close BroadcastChannel
    const channel = this.broadcastChannels.get(botName);
    if (channel) {
      channel.close();
      this.broadcastChannels.delete(botName);
    }

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

  // ==================== Private Methods ====================

  /**
   * Setup worker channel listener for part responses
   * Called when establishing connection to a worker part
   */
  private _setupWorkerChannelListener(botName: string, partName: string, channel: MessagePort): void {
    channel.onmessage = (event) => {
      const message = event.data as any;
      if (!message || !message.type) return;

      this._handleWorkerResponse(botName, partName, message);
    };
    channel.start();
  }

  /**
   * Handle responses from worker channels (part → kernel)
   */
  private _handleWorkerResponse(botName: string, partName: string, message: any): void {
    const { type } = message;

    if (type === 'activated' || type === 'deactivated' || type === 'reported') {
      const waiterId = `${botName}:${partName}:${type}`;
      const waiter = this.responseWaiters.get(waiterId);
      if (waiter) {
        clearTimeout(waiter.timeoutId);
        this.responseWaiters.delete(waiterId);
        this.log(`Received ${type} from ${partName}`);
        waiter.resolve();
      }
    }
  }

  /**
   * Wait for a response from a worker part
   */
  private _waitForPartResponse(
    botName: string,
    partName: string,
    expectedType: string,
    timeout: number
  ): Promise<void> {
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

  /**
   * Discover parts for a bot
   */
  private _discoverParts(botName: string): string[] {
    return this.partConfig[botName] ?? [];
  }

  /**
   * Resolve target part names based on include/exclude lists
   */
  private _resolvePartNames(
    botName: string,
    partNames?: string[],
    excludedPartNames?: string[]
  ): string[] {
    const botState = this.bots.get(botName);
    if (!botState) return [];

    const excluded = new Set(excludedPartNames ?? []);

    if (partNames && partNames.length > 0) {
      return partNames.filter((p) => !excluded.has(p));
    }

    return Array.from(botState.parts.keys()).filter((p) => !excluded.has(p));
  }

  /**
   * Deploy a part (lazy load)
   * Sets up worker channel (MessagePort) for kernel-to-part communication
   */
  private async _deployPart(botName: string, partName: string): Promise<void> {
    const partId = `${botName}:${partName}`;
    const part = this.partCache.get(partId);

    if (!part) {
      throw new Error(`Part ${partId} not found in cache`);
    }

    // In browser environment with MessagePort, parts are typically
    // already running workers that receive a MessagePort via postMessage.
    // This is where the kernel would establish the workerChannel (MessagePort).
    // For now, this is a placeholder for future worker instantiation logic.
    
    // When a worker is created and posts back with its MessagePort endpoint,
    // it would be set here: part.workerChannel = receivedMessagePort
    // Then: this._setupWorkerChannelListener(botName, partName, part.workerChannel)
    
    part.deployedAt = Date.now();
    this.log(`Deployed part: ${partId}`);
  }

  /**
   * Send message to a part via worker channel (MessagePort)
   * Kernel → Part communication
   */
  private _sendToWorkerChannel(botName: string, partName: string, message: any): void {
    const partId = `${botName}:${partName}`;
    const part = this.partCache.get(partId);

    if (!part || !part.workerChannel) {
      this.log(`⚠ No worker channel for ${partName}`);
      return;
    }

    try {
      part.workerChannel.postMessage({
        ...message,
        botName,
        partName,
        timestamp: Date.now(),
      });
      part.lastMessageAt = Date.now();
      this.log(`Sent ${message.type} to ${partName} via worker channel`);
    } catch (error) {
      this.log(`⚠ Failed to send to ${partName}: ${error}`);
    }
  }

  /**
   * Flush accumulated messages for a bot via BroadcastChannel
   * Part-to-part communication and user messages
   */
  private _flushMessageQueue(botName: string): void {
    const botState = this.bots.get(botName);
    if (!botState || botState.messageQueue.length === 0 || botState.isProcessing) {
      return;
    }

    botState.isProcessing = true;
    const messages = botState.messageQueue.splice(0, botState.messageQueue.length);

    // Broadcast messages to all parts in this bot via BroadcastChannel
    const broadcastMessage: BroadcastMessage = {
      type: 'message',
      botName,
      messages,
    };

    const channel = this.broadcastChannels.get(botName);
    if (channel) {
      channel.postMessage(broadcastMessage);
      this.log(`Broadcast ${messages.length} messages to ${botName} parts`);
    }

    // Reset processing flag after a short delay
    setTimeout(() => {
      botState.isProcessing = false;
      if (botState.messageQueue.length > 0) {
        this._flushMessageQueue(botName);
      }
    }, 50);
  }

  /**
   * Broadcast completion message to all parts via BroadcastChannel
   */
  private _broadcastCompletion(message: ActivateCompleted | DeactivateCompleted | ReportCompleted): void {
    const channel = this.broadcastChannels.get(message.botName);
    if (channel) {
      channel.postMessage(message);
      this.log(`Broadcast ${message.type} completion to ${message.botName} parts`);
    }
  }

  /**
   * Logging utility
   */
  private log(message: string): void {
    if (this.debug) {
      console.log(`[Kernel] ${message}`);
    }
  }
}

export default Kernel;
