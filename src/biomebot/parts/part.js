export class Part {

  constructor() {
    this.botName = "";
    this.partName = "";
    this.isActive = false;
    this.status = "blank";
    this._pendingMessages = [];
    this.engineName = "";
    this.engine = null;
    this.broadcastChannel = null;
    this._broadcastChannel = null;
  }

  init(botName,partName){
    this.botName = botName;
    this.partName = partName;
    this.isActive = false;
    this.status = "idle"
  }

  async deploy() {
    throw new Error("継承クラスでdeploy()を実装してください")
  }

  activate() {
    const engineCheck=this._checkEngine();
    if(engineCheck.status !== "ok"){
      return engineCheck;
    }
    
    this.isActive = true;
    return { status: "ok" }
  }

  deactivate() {
    const engineCheck=this._checkEngine();
    if(engineCheck.status !== "ok"){
      return engineCheck;
    }
    
    this.isActive = false;
    return { status: "ok" }
  }

  report() {
    throw new Error("継承クラスでreport()を実装してください")
  }

  _checkEngine() {
    if (this.engineName === "") {
      return { status: "error", message: "engineが未指定です" }
    }
    if (!this.engine) {
      return { status: "error", message: "engineが起動していません" }
    }
  }

}