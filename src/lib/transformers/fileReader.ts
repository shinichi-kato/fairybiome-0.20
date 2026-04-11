/**
 * Content ファイル読み込みユーティリティ
 * ファイルシステムから .dialog, .concept, .config ファイルを読み込み
 */

import fs from 'fs';
import path from 'path';

export interface ContentFile {
  relativePath: string;
  absolutePath: string;
  content: string;
  extension: 'dialog' | 'concept' | 'config';
  botId?: string;
  moduleName: string;
}

/**
 * content/botModules ディレクトリから すべての content ファイルを読み込み
 */
export function readContentFiles(): ContentFile[] {
  const contentDir = path.join(process.cwd(), 'content', 'botModules');
  const files: ContentFile[] = [];

  function walkDir(dir: string, relativePath = '') {
    if (!fs.existsSync(dir)) {
      return;
    }

    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const entryPath = path.join(dir, entry.name);
      const entryRelative = path.join(relativePath, entry.name);

      if (entry.isDirectory()) {
        walkDir(entryPath, entryRelative);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name);
        const baseFileName = path.basename(entry.name, ext);

        if (['.dialog', '.concept', '.config'].includes(ext)) {
          const content = fs.readFileSync(entryPath, 'utf-8');
          const extension = ext.substring(1) as 'dialog' | 'concept' | 'config';

          // botId: ボットディレクトリ名、moduleName: ファイル名
          const parts = entryRelative.split(path.sep);
          const botId = parts.length > 1 ? parts[0] : 'common';
          const moduleName = baseFileName;

          files.push({
            relativePath: entryRelative,
            absolutePath: entryPath,
            content,
            extension,
            botId,
            moduleName,
          });
        }
      }
    }
  }

  walkDir(contentDir);
  return files;
}
