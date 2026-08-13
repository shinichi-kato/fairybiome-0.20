import { describe, it, expect, vi } from 'vitest';
import { Biomebot } from './kernel.js';

describe('Biomebot input queue', () => {
  it('queues a message while waiting for orchestrator output and flushes it afterwards', () => {
    const kernel = Object.create(Biomebot.prototype);
    const postMessage = vi.fn();

    kernel.broadcastChannels = new Map([
      ['demo', { postMessage }],
    ]);
    kernel.botStates = {
      demo: {
        null: {
          isWaitingForOutput: true,
          inputQueue: [],
        },
      },
    };
    kernel._encodeTags = vi.fn((botName, message) => message);

    kernel.input('demo', { text: 'hello', displayName: 'user' });
    expect(kernel.botStates.demo.null.inputQueue).toHaveLength(1);
    expect(postMessage).not.toHaveBeenCalled();

    kernel.botStates.demo.null.isWaitingForOutput = false;
    kernel._flushInputQueue('demo');

    expect(postMessage).toHaveBeenCalledTimes(1);
    expect(postMessage).toHaveBeenCalledWith({
      type: 'input',
      message: { text: 'hello', displayName: 'user' },
    });
  });
});
