import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ChatBiomebot } from './kernel.js';

describe('ChatBiomebot', () => {
  let worker;

  beforeEach(() => {
    worker = { postMessage: vi.fn(), terminate: vi.fn() };
    global.Worker = class {
      constructor() {
        return worker;
      }
    };
  });

  it('deploys workers and returns the display metadata required by ChatUI', async () => {
    const bot = new ChatBiomebot({ aurula: ['static/bots/aurula/greeting.episode.json'] });

    await expect(bot.deploy('aurula')).resolves.toEqual({
      botName: 'aurula',
      displayName: 'aurula',
      backgroundColor: '#DDDDDD',
    });
    expect(worker.postMessage).toHaveBeenNthCalledWith(1, { type: 'init', botName: 'aurula', partName: 'greeting.episode' });
    expect(worker.postMessage).toHaveBeenNthCalledWith(2, { type: 'deploy', botName: 'aurula', partName: 'greeting.episode' });
    expect(worker.postMessage).toHaveBeenNthCalledWith(3, { type: 'activate', botName: 'aurula', partName: 'greeting.episode' });
  });

  it('adds display and correlation fields before delivering a Bot reply callback', async () => {
    const bot = new ChatBiomebot({ aurula: [] });
    const callback = vi.fn();
    bot.replyCallbackFunction = callback;
    await bot.deploy('aurula');
    await bot.input('aurula', { messageId: 'user-message-1', text: 'こんにちは' });

    bot._handleBroadcast('aurula', { type: 'output', message: { text: 'やあ', emo: 'happy' } });

    expect(callback).toHaveBeenCalledWith('aurula', expect.objectContaining({
      role: 'bot', text: 'やあ', avatar: 'happy', emo: 'happy', replyTo: 'user-message-1',
    }));
  });

  it('queues input until the current reply arrives', async () => {
    const bot = new ChatBiomebot({ aurula: [] });
    await bot.deploy('aurula');
    const channel = bot.broadcastChannels.get('aurula');
    const postMessage = vi.spyOn(channel, 'postMessage');

    await bot.input('aurula', { messageId: 'first', text: '一つ目' });
    await bot.input('aurula', { messageId: 'second', text: '二つ目' });
    expect(postMessage).toHaveBeenCalledTimes(1);

    bot._handleBroadcast('aurula', { type: 'output', message: { text: '返信' } });
    expect(postMessage).toHaveBeenCalledTimes(2);
  });
});