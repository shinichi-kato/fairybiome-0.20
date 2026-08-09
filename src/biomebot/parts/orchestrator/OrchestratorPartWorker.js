/*

 OrchrstratorPartWorker
 ======================

 */

 import { OrchestratorPart } from './OrchestratorPart';

 const orchestratorPart = new OrchestratorPart();

 let broadcastChannel = null;
 onmessage = async (messageEvent) => {
    const event = messageEvent.data;
    switch (event.type) {
        case 'init': {
            broadcastChannel = new BroadcastChannel(`biomebot-${event.botName}`);

            orchestratorPart.init(event.botName, event.partName,self,broadcastChannel,event.firestoreToken)
            return;
        }

        case 'deploy': {
            const res = await orchestratorPart.deploy();
            postMessage({ type: "deployed", status: res ? "ok" : "error" })
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
