import { describe, it, expect, vi } from 'vitest';
import { Part } from '../part.js';
import { OrchestratorPart } from './OrchestratorPart.js';

describe('OrchestratorPart', () => {
  it('inherits from the shared Part base class', () => {
    const part = new OrchestratorPart({ isWorker: false });

    expect(part).toBeInstanceOf(Part);
    expect(typeof part.activate).toBe('function');
  });

  it('transitions from standBy to deploy when a start token is returned', async () => {
    const orchestrator = {
      deployNotOnStage: vi.fn().mockResolvedValue({ state: 'standBy' }),
      deployNotFound: vi.fn().mockResolvedValue({ state: 'ready' }),
      retrieveNotOnStage: vi.fn().mockReturnValue({ text: 'はーい{START}', role: 'bot' }),
      reply: vi.fn().mockReturnValue({ text: 'ok', role: 'bot', score: 0.9 }),
    };

    const part = new OrchestratorPart({ orchestrator, isWorker: false });
    const events = [];
    part.addEventListener('reply', (event) => events.push(event.detail));

    await part.deploy('demo-bot', 'token');
    const reply = part.receive({ text: 'おーい' });

    expect(part.state).toBe('deploy');
    expect(reply.text).toBe('はーい');
    expect(events[0].text).toBe('はーい');
  });
});
