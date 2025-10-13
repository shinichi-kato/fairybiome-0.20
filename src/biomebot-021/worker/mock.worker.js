/* Mock worker.js */
const mockModule = {
  botId: null,
  moduleName: null,
  channel: null,

  init: ({ config }) => {
    mockModule.botId = config.botId;
    mockModule.moduleName = config.moduleName;
    mockModule.channel = new BroadcastChannel(`biomebot-${config.botId}`);
  }


}

self.onmessage = (event) => {
  const action = event.data;
  switch (action.type) {
    case 'init': {
      mockModule.init(action.config);
    }
    case 'status': {
      self.postMessage({ type: "status", botId: mockModule.botId, moduleName: mockModule.moduleName })

    }
  }
}