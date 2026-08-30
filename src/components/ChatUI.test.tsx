import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  bot: {
    deploy: vi.fn(),
    input: vi.fn(),
    shutdown: vi.fn(),
    replyCallbackFunction: null as unknown,
  },
  markFailed: vi.fn(),
  saveMessage: vi.fn(),
  subscribe: vi.fn(),
}));

vi.mock('../auth/AuthProvider', () => ({
  useAuth: () => ({
    user: { uid: 'user-1' },
    profile: { displayName: '花子', avatar: 'boy1', backgroundColor: '#789bc5' },
  }),
}));

vi.mock('../biomebot/kernel.js', () => ({
  ChatBiomebot: vi.fn(function ChatBiomebot() {
    return mocks.bot;
  }),
}));

vi.mock('../lib/chatLog', () => ({
  createConversationId: () => 'conversation-1',
  markChatLogMessageFailed: mocks.markFailed,
  saveChatLogMessage: mocks.saveMessage,
  subscribeToChatLog: mocks.subscribe,
}));

import ChatUI from './ChatUI';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.bot.deploy.mockResolvedValue({ botName: 'aurula', displayName: 'アウルラ', backgroundColor: '#b0bf74' });
  mocks.bot.input.mockResolvedValue(undefined);
  mocks.bot.shutdown.mockResolvedValue(undefined);
  mocks.saveMessage.mockResolvedValue(undefined);
  mocks.markFailed.mockResolvedValue(undefined);
  mocks.subscribe.mockReturnValue(vi.fn());
  HTMLDivElement.prototype.scrollTo = vi.fn();
});

describe('ChatUI', () => {
  it('deploys the selected bot and sends a valid message when Enter is pressed', async () => {
    render(<ChatUI botName="aurula" />);
    const input = screen.getByLabelText('メッセージ');

    fireEvent.change(input, { target: { value: 'こんにちは' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => {
      expect(mocks.saveMessage).toHaveBeenCalledWith('user-1', expect.objectContaining({
        botName: 'aurula', conversationId: 'conversation-1', role: 'user', text: 'こんにちは',
        displayName: '花子', avatar: 'neutral', emo: 'neutral', status: 'sent',
      }));
      expect(mocks.bot.input).toHaveBeenCalledWith('aurula', expect.objectContaining({ text: 'こんにちは' }));
    });
    expect(await screen.findByRole('heading', { name: 'アウルラ' })).toBeTruthy();
  });

  it('does not send when Shift+Enter is pressed', () => {
    render(<ChatUI botName="aurula" />);
    const input = screen.getByLabelText('メッセージ');

    fireEvent.change(input, { target: { value: '一行目' } });
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: true });

    expect(mocks.saveMessage).not.toHaveBeenCalled();
  });

  it('keeps the persisted message and records failure when Bot input fails', async () => {
    mocks.bot.input.mockRejectedValue(new Error('Bot に接続できません'));
    render(<ChatUI botName="aurula" />);
    const input = screen.getByLabelText('メッセージ');

    fireEvent.change(input, { target: { value: 'こんにちは' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => {
      expect(mocks.saveMessage).toHaveBeenCalledOnce();
      expect(mocks.markFailed).toHaveBeenCalledWith('user-1', expect.any(String), 'Bot に接続できません');
    });
  });
});