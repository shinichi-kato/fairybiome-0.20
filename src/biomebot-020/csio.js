// mainスクリプトをconceptStoreに読み込む
export function loadMain(conceptStore, script){
  const lines = script.split('\n');
  const csScript = [];
  const wmScript = [];

  for (let line of lines){
    line = line.trim();
    if (line.startsWith('#') || line === '') continue;

    if(line.startsWith("{:")){
      csScript.push(line);
    }
  }
}