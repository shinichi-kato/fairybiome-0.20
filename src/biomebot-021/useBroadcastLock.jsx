/*
useBroadcastLock
================

entityIdで指定された対象が二重に存在しないように排他制御を行う。
この範囲はウィンドウやタブをまたぐことからbroadcastChannelを利用する。
排他制御にはハートビート方式を利用し、ロック状態を維持するには
定期的にこちらからロックしていることをbroadcastする。

## ロックの競合状態
entityIdについて他者がロックした瞬間にロックした本人からのheartbeatが
実行され、revievedに保持される。それ以降はインターバルタイマーがheartbeatを
繰り返すことでロックが維持されていることがわかる。
ロックした本人が解除しないまま消滅した場合、ロックは有効期限切れになり
自動的に解除される。

usage:

const [locked,requestLock, forceLock, unlock] = 
  useBroadcastLock("channel name",eject)

locked: entityのロック状態( entityId:"locked by that" or "locked by this" or false)
requestLock(entityId): ロックを試みる。すでにロックされていたら失敗する
forceLock(entityId): ロックを強制する。すでにロックされていたらそれを解除してロックを奪う
unlock(entityId): ロックを解除する。

eject(entityId): ロックが強制的に解除された場合に呼び出されるcallback
*/

import React, { useRef, useEffect, useState } from 'react';

const EXPIRE_COUNT = 3; // interval*EXPIRE_COUNTがロック無効とみなす時間

export default function useBroadcastLock(channelName, eject, interval = 5000) {
  const [locked, setLocked] = useState({});
  const [recieved, setRecieved] = useState({});
  const channelRef = useRef();

  useEffect(() => {
    channelRef.current = new BroadcastChannel(channelName);
    channelRef.current.onmessage = (event) => {
      const action = event.data;
      switch (action.type) {
        case 'heartbeat': {
          setRecieved(prev => {
            let next = { ...prev };
            const timestamp = Date.now();
            for (let eid of action.eids) {
              next[eid] = timestamp;
            }
            return next;
          })
        }
        case 'eject': {
          const eids = action.eids;
          for (const eid of eids) {
            if (eid in locked) {
              eject(eid);
              setLocked(prev => {
                const next = { ...prev };
                delete next[eid];
                return next;
              });
              break;
            }
          }
        }
      }
    }
  }, [channelName]);

  useEffect(() => {
    if (interval !== null) {
      const intervId = setInterval(() => {
        // 他者がロックしたentityのheartbeatが途切れていたらrecievedから削除
        const now = Date.now();
        setRecieved(prev => {
          let next = {};
          for (let eid in prev) {
            const timestamp = prev[eid];
            if (now - timestamp > interval * EXPIRE_COUNT) {
              next[eid] = prev[eid]
            }
          }
          return next;
        });

        // 自分がロックしているentityが他者のheatbeatに含まれていたら
        // ejectを行う。

        for (const eid in locked) {
          if (eid in recieved) {
            // 他者が同じentityIdをロックしている → eject
            eject(eid);
            setLocked(prev => {
              const next = { ...prev };
              delete next[eid];
              return next;
            });
          }
        }

        // 自分がロックしているentityをbroadcast
        channelRef.current.postMessage({ action: "heartbeat", eids: Object.keys(locked) })
      }, interval);
      return () => clearInterval(intervId);
    }
    return undefined;

  }, [interval]);

  function requestLock(entityId) {
    // すでに自分でロックしていたら終了
    if (entityId in locked) return false;

    // すでに誰かがロックしていたら終了
    if (entityId in recieved) return false;

    setLocked(prev => ({ ...prev, [entityId]: Date.now() }));
    return true;
  }

  function forceLock(entityId) {
    // すでに自分でロックしていたら終了
    if (entityId in locked) return false;

    // すでに誰かがロックしていたら奪う
    if (entityId in recieved) {
      channelRef.current.postMessage({ action: "eject", entityId: entityId });
    }

    setLocked(prev => ({ ...prev, [entityId]: Date.now() }));
    return true;
  }

  function unlock(entityId = null) {
    // unlock(entityId) ... entityIdをロック解除
    // unlock() ... 全てロック解除
    if (entityId) {
      setLocked(prev => {
        const next = { ...prev };
        delete next[entityId];
        return next;
      });
    }
    else{
      setLocked([]);
    }
  }

  return [{ locked, recieved }, requestLock, forceLock, unlock];

}