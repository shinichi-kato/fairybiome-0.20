import { useEffect, useRef, useState } from 'react';

export default function useHeartbeat(botIds,  interval = 5000) {
  const [lastHeartbeat, setLastHeartbeat] = useState(null);
  const channelRef = useRef(null);

  // ハートビート送信
  useEffect(() => {
    if (!('BroadcastChannel' in window)) return;
    if (botIds.length !== 0) {
      const ch = {};
      for(let botId of botIds){
        ch[botId] = new BroadcastChannel(`Biomebot-${botId}`);
      }
      channelRef.current = ch;

      const timer = setInterval(() => {
        for(let botId of botIds){

        }
        ch.postMessage({ type: 'heartbeat', botId });
      }, interval);


    }
    return () => {
      clearInterval(timer);
      ch.close();
    };
  }, [botIds, interval]);

  // ハートビート受信
  useEffect(() => {
    if (!('BroadcastChannel' in window)) return;

    const ch = channelRef.current;
    if (!ch) return;

    const handler = (event) => {
      const { type, botId: incomingId } = event.data;
      if (type === 'heartbeat' && incomingId === botId) {
        setLastHeartbeat(new Date());
      }
    };

    ch.addEventListener('message', handler);
    return () => ch.removeEventListener('message', handler);
  }, [botId]);

  // 生存判定
  const isAlive = () => {
    if (!lastHeartbeat) return false;
    return new Date() - lastHeartbeat < interval * 1.5; // 少し余裕を持たせる
  };

  return { lastHeartbeat, isAlive };
}