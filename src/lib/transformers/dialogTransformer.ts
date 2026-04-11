/**
 * Dialog ファイルパーサー
 * .dialog 形式から会話ログと タグを抽出
 */

export interface DialogTag {
  key: string;
  value: string[];
}

export interface DialogMessage {
  head: string | null;
  text: string | null;
  date: string | null;
  time: string | null;
}

export interface ParsedDialog {
  tags: DialogTag[];
  messages: DialogMessage[];
}

function parseTimestamp(raw: string | undefined): { date: string | null; time: string | null } {
  if (!raw) return { date: null, time: null };

  // 日付と時刻 (12/1 08:30)
  const fullMatch = raw.match(/^(\d{1,2}\/\d{1,2})\s+(\d{1,2}:\d{2})$/);
  if (fullMatch) {
    return { date: fullMatch[1], time: fullMatch[2] };
  }

  // 日付のみ (12/1)
  const dateOnlyMatch = raw.match(/^(\d{1,2}\/\d{1,2})$/);
  if (dateOnlyMatch) {
    return { date: dateOnlyMatch[1], time: null };
  }

  // 時刻のみ (08:30)
  const timeOnlyMatch = raw.match(/^(\d{1,2}:\d{2})$/);
  if (timeOnlyMatch) {
    return { date: null, time: timeOnlyMatch[1] };
  }

  return { date: null, time: null };
}

export function parseDialog(content: string): ParsedDialog {
  const lines = content.split('\n');
  const tags: DialogTag[] = [];
  const messages: DialogMessage[] = [];

  let withText = '';
  let prevIsBlank = false;

  for (const line of lines) {
    // コメント行と空行
    if (line.startsWith('#') || line.trim() === '') {
      if (!prevIsBlank) {
        messages.push({ head: null, text: null, date: null, time: null });
      }
      prevIsBlank = true;
      continue;
    }
    prevIsBlank = false;

    // with 扱い（末尾に追加）
    const withMatch = line.match(/^with\s+(.+)$/);
    if (withMatch) {
      withText = withMatch[1];
      continue;
    }

    // タグ定義 {:key} value,value,...
    const tagMatch = line.match(/^\{(.+?)\}\s+(.+)/);
    if (tagMatch) {
      const [, tagName, tagValue] = tagMatch;
      tags.push({
        key: tagName,
        value: tagValue.split(',').map(v => v.trim()),
      });
      continue;
    }

    // メッセージ （head text(timestamp)）
    const messageMatch = line.match(/^(\w+)\s+(.+?)(?:\((.+?)\))?$/);
    if (messageMatch) {
      const [, head, text, rawTimestamp] = messageMatch;
      const timestamp = parseTimestamp(rawTimestamp);
      messages.push({
        head,
        text: text + withText,
        ...timestamp,
      });
      continue;
    }
  }

  return { tags, messages };
}
