export class Part {

  constructor(botName, partName) {
    const channelName = botName ? `biomebot-${botName}` : 'biomebot';
    this._broadcastChannel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(channelName) : null;
    this.botName = botName;
    this.partName = partName;
    this.isActive = false;
    this.state = "starting";
    this._pendingMessages = [];
    this.engineName = "";
    this.engine = null;

  }

  async deploy() {
    throw new Error("継承クラスでdeploy()を実装してください")
  }

  activate() {
    const engineCheck=this._checkEngine();
    if(engineCheck.state !== "ok"){
      return engineCheck;
    }
    
    this.isActive = true;
    return { state: "ok" }
  }

  deactivate() {
    const engineCheck=this._checkEngine();
    if(engineCheck.state !== "ok"){
      return engineCheck;
    }
    
    this.isActive = false;
    return { state: "ok" }
  }

  report() {
    throw new Error("継承クラスでreport()を実装してください")
  }

  _checkEngine() {
    if (this.engineName === "") {
      return { state: "error", message: "engineが未指定です" }
    }
    if (!this.engine) {
      return { state: "error", message: "engineが起動していません" }
    }
  }

}