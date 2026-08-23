/*

 OrchrstratorPartWorker
 ======================
 デバッグを容易にするためOrchestratorPartにはロジックを、
 Orchestator.worker.jsにはメッセージング関連を記述している。
 */

 import { OrchestratorPart } from './OrchestratorPart.js';

 const orchestratorPart = new OrchestratorPart();

 let broadcastChannel = null;
 onmessage = async (messageEvent) => {
    const event = messageEvent.data;
    switch (event.type) {
        case 'init': {
            broadcastChannel = new BroadcastChannel(`biomebot-${event.botName}`);

            orchestratorPart.init(event.botName, event.partName,  event.firestoreToken);
            broadcastChannel.onmessage = (channelEvent) => {
                const payload = channelEvent.data;
                switch (payload.type) {
                    case 'input': {
                        orchestratorPart.polling().then((output) => {
                            if (!output) return;
                            const message = {
                                type: 'output',
                                botName: orchestratorPart.botName,
                                message: output.message,
                                props: output.props,
                            };
                            if (broadcastChannel) {
                                broadcastChannel.postMessage(message);
                            }
                        });
                        break;
                    }
                    case 'innerVoice': {
                        orchestratorPart.receiveinnerVoice(payload.message);
                        break;
                    }
                    default:
                        break;
                }
            };
            return;
        }


        case 'deploy': {
            // orchestratorにはdeploy事項がない
            // const res = await orchestratorPart.deploy();
            postMessage({ type: "deployed", status: "ok"});
            return;
        }

        case 'activate': {
            const res = orchestratorPart.activate();
            if (res.status == 'ok') {
                postMessage({ type: "activated" });
            }
            postMessage(res);
            return;
        }

        case 'deactivate': {
            const res = orchestratorPart.deactivate();
            if (res.status == 'ok') {
                postMessage({ type: "deactivated" });
            }
            postMessage(res);
            return;
        }

        case 'report': {
            const res = orchestratorPart.report();
            postMessage(res)
        }

        case 'terminate': {
            orchestratorPart.terminate();
            return;
        }

                
    }

 }
