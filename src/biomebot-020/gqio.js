  // 全チャットボットのmainから
  // チャットボットの識別名(dir名)と内容を抽出。
  export function getChatbotList(snap){
    const report = {};
    snap.allPalinText.nodes.forEach(node=>{
      const rd = node.relativeDirectory; 
      if(node.relativeDirectory !== ""){
        report[rd] = content;
      }
    });

    return report;
}