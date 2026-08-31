import {
  collection,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db } from './firebase';
import { avatarDirectory, type ChatLogMessage } from './chatMessage';

const MAX_LOG_MESSAGES_PER_BOT = 500;

export function subscribeToChatLog(
  userId: string,
  botName: string,
  conversationId: string,
  onMessages: (messages: ChatLogMessage[]) => void,
  onError: (error: Error) => void
) {
  const messagesQuery = query(
    collection(db, 'users', userId, 'log'),
    where('botName', '==', botName),
    where('conversationId', '==', conversationId),
    orderBy('createdAtClient', 'asc')
  );

  return onSnapshot(
    messagesQuery,
    snapshot => {
      onMessages(snapshot.docs.map(item => {
        const data = item.data();
        return { id: item.id, ...data, avatarDir: avatarDirectory(data.avatarDir) } as ChatLogMessage;
      }));
    },
    onError
  );
}

export async function saveChatLogMessage(userId: string, message: ChatLogMessage): Promise<void> {
  const messageRef = doc(db, 'users', userId, 'log', message.id);
  await setDoc(messageRef, {
    ...message,
    createdAt: serverTimestamp(),
  });
  await pruneChatLog(userId, message.botName);
}

export async function markChatLogMessageFailed(
  userId: string,
  messageId: string,
  error: string
): Promise<void> {
  await updateDoc(doc(db, 'users', userId, 'log', messageId), {
    status: 'failed',
    error,
  });
}

export async function pruneChatLog(userId: string, botName: string): Promise<void> {
  const messagesQuery = query(
    collection(db, 'users', userId, 'log'),
    where('botName', '==', botName),
    orderBy('createdAtClient', 'desc'),
    limit(MAX_LOG_MESSAGES_PER_BOT + 1)
  );
  const snapshot = await getDocs(messagesQuery);

  if (snapshot.docs.length <= MAX_LOG_MESSAGES_PER_BOT) {
    return;
  }

  const batch = writeBatch(db);
  for (const message of snapshot.docs.slice(MAX_LOG_MESSAGES_PER_BOT)) {
    batch.delete(message.ref);
  }
  await batch.commit();
}

export function createConversationId(): string {
  return globalThis.crypto.randomUUID();
}