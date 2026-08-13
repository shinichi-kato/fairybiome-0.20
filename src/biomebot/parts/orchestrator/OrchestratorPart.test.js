import { describe, it, expect, vi } from 'vitest';

import { OrchestratorPart } from './OrchestratorPart.js';
import { Message } from '../../../Message.js';

describe('OrchestratorPart', () => {
  it('returns an empty output when there are no inner speech candidates', () => {
    const part = new OrchestratorPart();

    const result = part.integrate();

    expect(result).toMatchObject({
      type: 'output',
      message: null,
      props: { partNames: [] },
    });
  });

  it('prefers the stronger self message and merges part names when both self and other exist', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);

    const part = new OrchestratorPart();
    part.innerSpeechPool = [
      new Message({
        role: 'bot',
        text: 'other message',
        target: 'other',
        emo: 'neutral',
        props: { score: 8, partNames: ['episode'], botName: 'demo' },
      }),
      new Message({
        role: 'bot',
        text: 'self message',
        target: 'self',
        emo: 'happy',
        props: { score: 10, partNames: ['orchestrator'], botName: 'demo' },
      }),
    ];

    const result = part.integrate();

    expect(result.message.text).toBe('other message');
    expect(result.message.emo).toBe('happy');
    expect(result.props.partNames).toEqual(expect.arrayContaining(['episode', 'orchestrator']));

    vi.restoreAllMocks();
  });
});
