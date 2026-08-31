import { build } from 'esbuild';

await build({
  entryPoints: {
    'EpisodePart.worker': 'src/biomebot/parts/episode/EpisodePart.worker.js',
    'Orchestrator.worker': 'src/biomebot/parts/orchestrator/Orchestrator.worker.js',
  },
  bundle: true,
  format: 'esm',
  outdir: 'public/biomebot-workers',
  platform: 'browser',
  target: 'es2022',
});
