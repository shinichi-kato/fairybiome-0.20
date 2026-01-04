global.BroadcastChannel = class {
  constructor(name) {
    this.name = name;
    this.onmessage = null;
  }
  postMessage(message) {
    if (this.onmessage) {
      this.onmessage({ data: message });
    }
  }
  close() {}
};