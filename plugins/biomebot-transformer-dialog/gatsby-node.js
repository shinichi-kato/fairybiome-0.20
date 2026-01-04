/*
.dialog形式のファイルをgraphqlに読み込む。

transformerでの処理が多いほど実行時の速度に有利だが、新しく記憶したことは
ランタイムで反映できたほうが良いため会話で学習したログの部分に影響しない
処理を行う。

.dialogのファイル形式
```
#で始まる行はコメント、
{key} value,value,...はmemoryStoreへの記憶
ユーザ発言は
user テキスト(12/1 8:20)
のように'user'から始まり、スペースに続いて出力するテキストをそのまま表記する。
末尾にタイムスタンプを書くことができ、
(12/1) 日付のみ
(8:20) 時刻のみ
(12/1 8:21) 日付と時刻
のいずれかの形式にする。

チャットボットの発言は冒頭が
bot
またはavatar名
greeting
などを指定する。
空行は話題の切り替わりとなる。

with で始まる行に書かれた内容は以降のtext末尾にコピーされる。
withは複数行書かれた場合最新行のみ有効になる。
```
# 
{animal} うさぎ,キリン,象
user こんにちは！(1/1 8:20)
bot こんにちは。元気でした？ (1/1 8:20)
```
graphql上では会話部分は
messages: [{head, text, date, time},]
空行は
{head:null,text:null,data:null,time:null}
とし、メモリ部分は
tags: {key:value}
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
  const tags = [];
  const messages = [];

  const parseTimestamp = (raw) => {
    if (!raw) return null;

    // 日付と時刻 (12/1 08:30)
    const fullMatch = raw.match(/^(\d{1,2}\/\d{1,2})\s+(\d{1,2}:\d{1,2})$/);
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
    const timeOnlyMatch = raw.match(/^(\d{1,2}:\d{1,2})$/);
    if (timeOnlyMatch) {
      return {
        date: null,
        time: timeOnlyMatch[1],
      };
    }

    return { date: null, time: null };
  };

  let withText = "";
  let prevIsBlank = false;
  for (const line of lines) {
    if (line.startsWith("#") || line.trim() === "") {
      if (!prevIsBlank) {
        messages.push({ head: null, text: null, timestamp: null });
      }
      prevIsBlank = true;
      continue;
    }
    prevIsBlank = false;

    const withMatch = line.match(/^with\s+(.+)$/);
    if (withMatch) {
      withText = withMatch[1];
      continue;
    }

    const tagMatch = line.match(/^\{(.+?)\}\s+(.+)/);
    if (tagMatch) {
      const [_, tagName, tagValue] = tagMatch;
      tags.push({ key: tagName, value: tagValue.split(",").map((v) => v.trim()) });
      continue;
    }

    const messageMatch = line.match(/^(\w+)\s+(.+?)(?:\((.+?)\))?$/);
    if (messageMatch) {
      const [_, head, text, rawTimestamp] = messageMatch;
      const timestamp = parseTimestamp(rawTimestamp);
      messages.push({
        head,
        text: text.concat(withText),
        ...timestamp,
      });
      continue;
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
