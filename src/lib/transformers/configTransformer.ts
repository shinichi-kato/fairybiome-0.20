/**
 * Config ファイルパーサー
 * .config 形式からキー・バリューを抽出
 */

export interface BotConfig {
  [key: string]: string | number;
}

export function parseConfig(content: string): BotConfig {
  const config: BotConfig = {};
  const lines = content.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();

    // コメント行と空行をスキップ
    if (trimmed.startsWith('#') || trimmed === '') {
      continue;
    }

    const [key, valueRaw] = trimmed.split(':');
    if (!key || !valueRaw) {
      continue;
    }

    const keyClean = key.trim();
    let value: string | number = valueRaw.trim();

    // 数値変換（必要に応じて）
    const numValue = parseFloat(value as string);
    if (!isNaN(numValue)) {
      value = numValue;
    }

    config[keyClean] = value;
  }

  return config;
}
