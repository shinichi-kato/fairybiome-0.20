/*
 EpisodePartWorker
===================
 EpisodePartをweb worker化するラッパー
*/

import EpisodePart from './EpisodePart';

const episodePart = new EpisodePart();

onmessage = (e) => {
  const event = e.data;
  switch (event.type) {
    case 'init': {
      episodePart.init(event.botName, event.partName);
      postMessage({ type: "initialized" });
      return;
    }
    case 'deploy': {
      const res = episodePart.deploy();
      postMessage({ type: "deployed", status: res ? "ok" : "error" })
      return;
    }

    case 'activate': {
      const res = episodePart.activate();
      if (res.status == 'ok') {
        postMessage({ type: "activated" });
      }
      postMessage(res);
      return;
    }

    case 'deactivate': {
      const res = episodePart.deactivate();
      if (res.status == 'ok') {
        postMessage({ type: "deactivated" });
      }
      postMessage(res);
      return;
    }

    case 'report': {
      const res = episodePart.report();
      postMessage(res)
    }

    case 'terminate': {
      episodePart.terminate();
      return;
    }
  }
}

const broadcastChannel = new BroadcastChannel(`biomebot-${episodePart.botName}`);
broadcastChannel.onmessage = (e) => {
  const event = e.data;

  switch (event.type) {
    case 'message': {
      const res = episodePart.receive(event.message);
      postMessage({ type: "innerSpeech", message: res })
      return;
    }
  }
}