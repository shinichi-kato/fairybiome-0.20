'use client';

import { use } from 'react';
import ChatUI from '../../../components/ChatUI';

export default function ChatPage({ params }: { params: Promise<{ botName: string }> }) {
  const { botName } = use(params);

  return <ChatUI botName={decodeURIComponent(botName)} />;
}
