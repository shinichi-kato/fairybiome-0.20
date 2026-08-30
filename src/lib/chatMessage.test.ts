import { describe, expect, it } from 'vitest';
import { avatarFileName, MAX_CHAT_MESSAGE_LENGTH, validateChatInput } from './chatMessage';

describe('validateChatInput', () => {
  it('rejects blank messages', () => {
    expect(validateChatInput(' \n ')).toBe('メッセージを入力してください。');
  });

  it('enforces the 200 character limit', () => {
    expect(validateChatInput('a'.repeat(MAX_CHAT_MESSAGE_LENGTH))).toBeNull();
    expect(validateChatInput('a'.repeat(MAX_CHAT_MESSAGE_LENGTH + 1))).toBe(
      'メッセージは200文字以内で入力してください。'
    );
  });
});

describe('avatarFileName', () => {
  it('uses neutral for users and the bot emotion for bot messages', () => {
    expect(avatarFileName('user', 'happy')).toBe('neutral.svg');
    expect(avatarFileName('bot', 'happy')).toBe('happy.svg');
  });

  it('falls back to neutral for an invalid bot emotion', () => {
    expect(avatarFileName('bot', '../happy')).toBe('neutral.svg');
  });
});