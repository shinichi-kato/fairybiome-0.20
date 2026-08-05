/*

 OrchrstratorPartWorker
 ======================

 */

 import { OrchestratorPart } from './OrchestratorPart';

 const orchestratorPart = new OrchestratorPart();

 onmessage = async (messageEvent: MessageEvent) => {
    const event = messageEvent.data;
    switch (event.type) {
        case ''