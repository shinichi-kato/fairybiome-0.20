export const MAX_CHAT_MESSAGE_LENGTH = 200;

export type ChatRole = 'user' | 'bot';
export type ChatMessageStatus = 'queued' | 'sent' | 'failed';

export type ChatLogMessage = {
  id: string;
  botName: string;
  conversationId: string;
  role: ChatRole;
  text: string;
  createdAtClient: number;
  displayName: string;
  backgroundColor: string;
  avatarDir: string;
  avatar: string;
  emo: string;
  status: ChatMessageStatus;
  error?: string;
  replyTo?: string;
};

export type BotDeployment = {
  botName: string;
  displayName: string;
  backgroundColor: string;
};

export function validateChatInput(value: string): string | null {
  if (!value.trim()) {
    return 'メッセージを入力してください。';
  }

  if (value.length > MAX_CHAT_MESSAGE_LENGTH) {
    return `メッセージは${MAX_CHAT_MESSAGE_LENGTH}文字以内で入力してください。`;
  }

  return null;
}

export function avatarFileName(role: ChatRole, emo: string): string {
  if (role === 'user') {
    return 'neutral.svg';
  }

  return /^[a-z0-9_-]+$/i.test(emo) ? `${emo}.svg` : 'neutral.svg';
}