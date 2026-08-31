'use client';

import Link from 'next/link';
import { ArrowLeft, Send } from 'lucide-react';
import { type KeyboardEvent, useEffect, useRef, useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { ChatBiomebot } from '../biomebot/kernel.js';
import { createConversationId, markChatLogMessageFailed, saveChatLogMessage, subscribeToChatLog } from '../lib/chatLog';
import { avatarDirectory, avatarFileName, type BotDeployment, type ChatLogMessage, validateChatInput } from '../lib/chatMessage';
import FairyPanel from './Panel/FairyPanel';
import UserPanel from './Panel/UserPanel';

type ChatUIProps = {
  botName: string;
};

function readBotPaths(): Record<string, string[]> {
  try {
    const staticFiles = JSON.parse(process.env.NEXT_PUBLIC_STATIC_FILES ?? '{}');
    return staticFiles?.bots && typeof staticFiles.bots === 'object' ? staticFiles.bots : {};
  } catch {
    return {};
  }
}

function makeId(): string {
  return globalThis.crypto.randomUUID();
}

export default function ChatUI({ botName }: ChatUIProps) {
  const { user, profile } = useAuth();
  const [conversationId] = useState(createConversationId);
  const [messages, setMessages] = useState<ChatLogMessage[]>([]);
  const [input, setInput] = useState('');
  const [deployment, setDeployment] = useState<BotDeployment | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDeploying, setIsDeploying] = useState(true);
  const logRef = useRef<HTMLDivElement>(null);
  const botRef = useRef<ChatBiomebot | null>(null);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [messages]);

  useEffect(() => {
    if (!user) {
      return;
    }

    let disposed = false;
    setIsDeploying(true);
    setError(null);
    const unsubscribe = subscribeToChatLog(user.uid, botName, conversationId, setMessages, snapshotError => setError(snapshotError.message));
    const bot = new ChatBiomebot(readBotPaths());
    botRef.current = bot;
    bot.replyCallbackFunction = async (_replyBotName: string, reply: ChatLogMessage & { messageId?: string }) => {
      if (disposed) {
        return;
      }

      try {
        await saveChatLogMessage(user.uid, {
          ...reply,
          id: reply.messageId ?? makeId(),
          botName,
          conversationId,
          role: 'bot',
          status: 'sent',
          avatar: reply.emo || 'neutral',
          emo: reply.emo || 'neutral',
        });
      } catch (callbackError) {
        if (!disposed) {
          setError(callbackError instanceof Error ? callbackError.message : '返信を保存できませんでした。');
        }
      }
    };

    void bot.deploy(botName)
      .then(result => {
        if (!disposed) {
          setDeployment(result);
        }
      })
      .catch(deployError => {
        if (!disposed) {
          setError(deployError instanceof Error ? deployError.message : 'Bot を起動できませんでした。');
        }
      })
      .finally(() => {
        if (!disposed) {
          setIsDeploying(false);
        }
      });

    return () => {
      disposed = true;
      unsubscribe();
      void bot.shutdown(botName);
      if (botRef.current === bot) {
        botRef.current = null;
      }
    };
  }, [botName, conversationId, user]);

  async function sendMessage() {
    if (!user || !profile) {
      return;
    }

    const validationError = validateChatInput(input);
    if (validationError) {
      setError(validationError);
      return;
    }

    const message: ChatLogMessage = {
      id: makeId(), botName, conversationId, role: 'user', text: input, createdAtClient: Date.now(),
      displayName: profile.displayName, backgroundColor: profile.backgroundColor, avatarDir: avatarDirectory(profile.avatar),
      avatar: 'neutral', emo: 'neutral', status: 'sent',
    };

    setError(null);
    setInput('');
    try {
      await saveChatLogMessage(user.uid, message);
      await botRef.current?.input(botName, { ...message, messageId: message.id });
    } catch (sendError) {
      const errorMessage = sendError instanceof Error ? sendError.message : 'Bot に送信できませんでした。';
      setError(errorMessage);
      try {
        await markChatLogMessageFailed(user.uid, message.id, errorMessage);
      } catch {
        setError('送信失敗状態を保存できませんでした。');
      }
    }
  }

  function handleInputKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void sendMessage();
    }
  }

  const latestBotMessage = [...messages].reverse().find(message => message.role === 'bot');

  return (
    <main className="flex h-dvh flex-col overflow-hidden bg-secondary px-3 py-3 sm:px-6">
      <header className="flex items-center border-b border-gray-300 pb-3">
        <Link href="/" aria-label="メインメニューに戻る" className="inline-flex h-10 w-10 items-center justify-center text-primary hover:bg-white">
          <ArrowLeft aria-hidden="true" size={22} />
        </Link>
        <h1 className="ml-2 text-lg font-bold text-gray-900">{deployment?.displayName ?? botName}</h1>
        {isDeploying && <span className="ml-2 text-sm text-gray-600">起動中...</span>}
      </header>

      <div ref={logRef} className="min-h-0 flex-1 overflow-y-auto py-4" aria-live="polite">
        {messages.map(message => {
          const isBot = message.role === 'bot';
          const avatarPath = isBot
            ? `/avatar/chatbot/${message.avatarDir}/${avatarFileName('bot', message.emo)}`
            : `/avatar/user/${message.avatarDir}/peace.svg`;
          return (
            <article key={message.id} className={`mb-4 flex items-end gap-2 ${isBot ? '' : 'flex-row-reverse'}`}>
              <img className="h-11 w-11 shrink-0 object-contain" src={avatarPath} alt="" />
              <div className={`max-w-[78%] ${isBot ? '' : 'text-right'}`}>
                <p className="mb-1 text-xs font-semibold text-gray-700">{message.displayName}</p>
                <p className="whitespace-pre-wrap break-words border border-gray-400 bg-white px-3 py-2 text-left text-gray-900">{message.text}</p>
                {message.status === 'failed' && <p className="mt-1 text-xs text-red-700">{message.error ?? '送信に失敗しました。'}</p>}
              </div>
            </article>
          );
        })}
      </div>
      <div className="flex shrink-0 items-end justify-between">
        {latestBotMessage ? (
          <FairyPanel
            repr={{
              avatarDir: latestBotMessage.avatarDir,
              avatar: latestBotMessage.avatar,
              backgroundColor: latestBotMessage.backgroundColor,
              botState: latestBotMessage.emo,
            }}
          />
        ) : <div />}
        <UserPanel
          user={profile ? {
            displayName: profile.displayName,
            avatarDir: avatarDirectory(profile.avatar),
            backgroundColor: profile.backgroundColor,
          } : null}
          panelWidth={192}
        />
      </div>


      <form className="flex shrink-0 items-end gap-2 border-t border-gray-300 pt-3" onSubmit={event => { event.preventDefault(); void sendMessage(); }}>
        <textarea aria-label="メッセージ" className="min-h-11 flex-1 resize-none border border-gray-500 bg-white px-3 py-2 text-base focus:outline-2 focus:outline-primary" maxLength={200} onChange={event => setInput(event.target.value)} onKeyDown={handleInputKeyDown} rows={2} value={input} />
        <button type="submit" aria-label="送信" className="flex h-11 w-11 shrink-0 items-center justify-center bg-primary text-white disabled:opacity-50" disabled={!input.trim()}>
          <Send aria-hidden="true" size={20} />
        </button>
      </form>
      {error && <p className="shrink-0 pt-2 text-sm text-red-700" role="alert">{error}</p>}
    </main>
  );
}