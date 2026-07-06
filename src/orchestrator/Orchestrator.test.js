import { describe, it, expect, vi } from 'vitest';
import { Orchestrator } from './Orchestrator.js';

describe('Orchestrator', () => {
  it('deploys not-on-stage data and returns a start response', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        title: 'Orchestrator',
        factor: { intervals: [300, 200, 250], attenuation: 0.7 },
        notFound: {
          factor: { activity: 1, precision: 0.4 },
          columns: ['role', 'text', 'date', 'time', 'emo', 'location'],
          data: [['user', '？', null, null, '期待', 'private'], ['bot', 'うーん', null, null, '期待', 'private']],
        },
        notOnStage: {
          factor: { activity: 1, precision: 0.4 },
          columns: ['role', 'text', 'date', 'time', 'emo', 'location'],
          data: [['user', 'おーい', null, '8:30', '期待', 'private'], ['bot', 'はーい{START}', null, '8:30', '期待', 'private']],
        },
      }),
    });

    const orchestrator = new Orchestrator({ fetchImpl });
    const result = await orchestrator.deployNotOnStage('demo-bot', 'token');

    expect(result.state).toBe('standBy');
    const reply = orchestrator.retrieveNotOnStage({ text: 'おーい' });
    expect(reply.text).toContain('はーい');
    expect(reply.text).not.toContain('{START}');
  });

  it('selects the highest-scoring reply after attenuation', () => {
    const orchestrator = new Orchestrator({
      config: {
        factor: { attenuation: 0.7 },
      },
    });

    const result = orchestrator.reply([
      { text: 'first', score: 1 },
      { text: 'second', score: 1 },
    ]);

    expect(result.text).toBe('first');
    expect(result.score).toBeGreaterThan(0);
  });
});
