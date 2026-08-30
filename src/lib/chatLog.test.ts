import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChatLogMessage } from './chatMessage';

const mocks = vi.hoisted(() => ({
  batchCommit: vi.fn(),
  batchDelete: vi.fn(),
  getDocs: vi.fn(),
  onSnapshot: vi.fn(),
  setDoc: vi.fn(),
  updateDoc: vi.fn(),
}));

vi.mock('./firebase', () => ({ db: {} }));

vi.mock('firebase/firestore', () => ({
  collection: vi.fn((...path: string[]) => path),
  doc: vi.fn((...path: string[]) => path),
  getDocs: mocks.getDocs,
  limit: vi.fn(value => ({ limit: value })),
  onSnapshot: mocks.onSnapshot,
  orderBy: vi.fn((field, direction) => ({ field, direction })),
  query: vi.fn((...parts) => parts),
  serverTimestamp: vi.fn(() => 'server-timestamp'),
  setDoc: mocks.setDoc,
  updateDoc: mocks.updateDoc,
  where: vi.fn((field, operator, value) => ({ field, operator, value })),
  writeBatch: vi.fn(() => ({
    delete: mocks.batchDelete,
    commit: mocks.batchCommit,
  })),
}));

import {
  markChatLogMessageFailed,
  pruneChatLog,
  saveChatLogMessage,
  subscribeToChatLog,
} from './chatLog';

const message: ChatLogMessage = {
  id: 'message-1',
  botName: 'aurula',
  conversationId: 'conversation-1',
  role: 'user',
  text: 'こんにちは',
  createdAtClient: 1,
  displayName: 'ユーザ',
  backgroundColor: '#ffffff',
  avatarDir: 'boy1',
  avatar: 'neutral',
  emo: 'neutral',
  status: 'queued',
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getDocs.mockResolvedValue({ docs: [] });
  mocks.setDoc.mockResolvedValue(undefined);
  mocks.updateDoc.mockResolvedValue(undefined);
  mocks.batchCommit.mockResolvedValue(undefined);
});

describe('subscribeToChatLog', () => {
  it('subscribes to the active bot conversation in chronological order', () => {
    const onMessages = vi.fn();
    const onError = vi.fn();
    mocks.onSnapshot.mockImplementation((_query, next) => {
      next({ docs: [{ id: message.id, data: () => message }] });
      return vi.fn();
    });

    subscribeToChatLog('user-1', 'aurula', 'conversation-1', onMessages, onError);

    expect(onMessages).toHaveBeenCalledWith([message]);
    expect(mocks.onSnapshot).toHaveBeenCalledOnce();
  });
});

describe('chat log writes', () => {
  it('stores a message with a server timestamp before pruning', async () => {
    await saveChatLogMessage('user-1', message);

    expect(mocks.setDoc).toHaveBeenCalledWith(
      [{}, 'users', 'user-1', 'log', 'message-1'],
      { ...message, createdAt: 'server-timestamp' }
    );
    expect(mocks.getDocs).toHaveBeenCalledOnce();
  });

  it('marks a persisted user message as failed without deleting it', async () => {
    await markChatLogMessageFailed('user-1', message.id, 'Bot の起動に失敗しました。');

    expect(mocks.updateDoc).toHaveBeenCalledWith(
      [{}, 'users', 'user-1', 'log', 'message-1'],
      { status: 'failed', error: 'Bot の起動に失敗しました。' }
    );
  });

  it('removes the oldest message when the per-bot cap is exceeded', async () => {
    const docs = Array.from({ length: 501 }, (_, index) => ({ ref: `message-${index}` }));
    mocks.getDocs.mockResolvedValue({ docs });

    await pruneChatLog('user-1', 'aurula');

    expect(mocks.batchDelete).toHaveBeenCalledWith('message-500');
    expect(mocks.batchCommit).toHaveBeenCalledOnce();
  });
});