/*
.dialog形式のファイルをgraphqlに読み込む。

graphql上では会話部分は
{speaker, context, date, time}
空行は
{speaker:null,context:null,data:null,time:null}
とする。
メモリ部分は
m
{key:value}
*/

exports.onCreateNode = async ({
  node,
  actions,
  loadNodeContent,
  createNodeId
}) => {
  const { createNode, createParentChildLink } = actions;

  // .dialog ファイルのみ対象
  if (node.extension !== "dialog") {
    return;
  }

  const content = await loadNodeContent(node);
  const lines = content.split("\n");
  console.log("dialog lines",lines)
  const tags = [];
  const messages = [];

  const parseTimestamp = (raw) => {
    if (!raw) return null;

    // 日付と時刻 (12/1 08:30)
    const fullMatch = raw.match(/^(\d{1,2}\/\d{1,2})\s+(\d{1,2}:\d{2})$/);
    if (fullMatch) {
      return {
        date: fullMatch[1],
        time: fullMatch[2],
      };
    }

    // 日付のみ (12/1)
    const dateOnlyMatch = raw.match(/^(\d{1,2}\/\d{1,2})$/);
    if (dateOnlyMatch) {
      return {
        date: dateOnlyMatch[1],
        time: null,
      };
    }

    // 時刻のみ (08:30)
    const timeOnlyMatch = raw.match(/^(\d{1,2}:\d{2})$/);
    if (timeOnlyMatch) {
      return {
        date: null,
        time: timeOnlyMatch[1],
      };
    }

    return null;
  };

  for (const line of lines) {
    if (line.startsWith("#")) continue;

    const tagMatch = line.match(/^\{(.+?)\}\s+(.+)/);
    if (tagMatch) {
      const [_, tagName, tagValue] = tagMatch;
      tags.push({key:tagName,value:tagValue.split(",").map((v) => v.trim())});
      continue;
    }

    const messageMatch = line.match(/^(\w+)\s+(.+?)(?:\((.+?)\))?$/);
    if (messageMatch) {
      const [_, speaker, text, rawTimestamp] = messageMatch;
      const timestamp = parseTimestamp(rawTimestamp);
      messages.push({
        speaker,
        text,
        timestamp,
      });
      continue;
    }
    if (line.trim() === "") {
      messages.push({ speaker: null, text: null, timestamp: { date: null, time: null } });
    }

  }

  const dialogNode = {
    id: createNodeId(`${node.id}-dialog`),
    tags,
    messages,
    parent: node.id,
    internal: {
      type: "DialogStore",
      contentDigest: node.internal.contentDigest,
    },
  };

  createNode(dialogNode);
  createParentChildLink({ parent: node, child: dialogNode });
};
