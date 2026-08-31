import { readFile } from 'node:fs/promises';
import path from 'node:path';

const BOT_NAME_PATTERN = /^[A-Za-z0-9_-]+$/;
const PART_NAME_PATTERN = /^[A-Za-z0-9_.-]+\.(episode|orchestrator)$/;

export async function GET(_request: Request, { params }: { params: Promise<{ botName: string; partName: string }> }) {
  const { botName, partName } = await params;
  if (!BOT_NAME_PATTERN.test(botName) || !PART_NAME_PATTERN.test(partName)) {
    return new Response('Not found', { status: 404 });
  }

  try {
    const filePath = path.join(process.cwd(), 'static', 'bots', botName, `${partName}.json`);
    const json = await readFile(filePath, 'utf8');
    return new Response(json, { headers: { 'Content-Type': 'application/json' } });
  } catch {
    return new Response('Not found', { status: 404 });
  }
}