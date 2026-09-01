import { readFile } from 'node:fs/promises';
import path from 'node:path';

const BOT_NAME_PATTERN = /^[A-Za-z0-9_-]+$/;
const FILE_NAME_PATTERN = /^[A-Za-z0-9_-]+\.(svg|png)$/;

const CONTENT_TYPES: Record<string, string> = {
  svg: 'image/svg+xml',
  png: 'image/png',
};

export async function GET(_request: Request, { params }: { params: Promise<{ botName: string; fileName: string }> }) {
  const { botName, fileName } = await params;
  if (!BOT_NAME_PATTERN.test(botName) || !FILE_NAME_PATTERN.test(fileName)) {
    return new Response('Not found', { status: 404 });
  }

  try {
    const filePath = path.join(process.cwd(), 'static', 'bots', botName, 'avatar', fileName);
    const file = await readFile(filePath);
    const ext = fileName.split('.').pop() ?? '';
    return new Response(file, { headers: { 'Content-Type': CONTENT_TYPES[ext] ?? 'application/octet-stream' } });
  } catch {
    return new Response('Not found', { status: 404 });
  }
}
