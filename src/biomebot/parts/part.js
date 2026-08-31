export class Part {

  constructor() {
    this.botName = "";
    this.partName = "";
    this.isActive = false;
    this.status = "blank";
    this._pendingMessages = [];
    this.engineName = "";
    this.engine = null;
  }

  async _init(botName, partName, firestoreToken = null) {
    this.botName = botName;
    this.partName = partName;
    this.firestoreToken = firestoreToken;
    this.isActive=false;
    this.status = "idle";

    const path = `/api/bots/${encodeURIComponent(botName)}/${encodeURIComponent(partName)}`;
    let response;

    try {
      response = await fetch(path);
    } catch (err) {
      console.warn(`failed to fetch "${path}"`, err);
      return;
    }

    if (!response.ok) {
      console.warn(`failed to load "${path}" (${response.status})`);
      return;
    }

    let data;
    try {
      data = await response.json();
    } catch (err) {
      console.warn(`failed to parse JSON in "${path}"`, err);
      return;
    }
    return data;
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
    return { status: "ok" }
  }

}