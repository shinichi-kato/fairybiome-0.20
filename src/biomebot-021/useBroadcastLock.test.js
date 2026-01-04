import { renderHook, act } from '@testing-library/react';
import useBroadcastLock from './useBroadcastLock';

global.BroadcastChannel = require('./__mocks__/BroadcastChannel').BroadcastChannel;

describe('useBroadcastLock', () => {
  const ejectMock = vi.fn();

  it('should request and release lock correctly', () => {
    const { result } = renderHook(() => useBroadcastLock('test-channel', ejectMock, 1000));

    const [locked, requestLock, forceLock, unlock] = result.current;

    act(() => {
      const success = requestLock('entity1');
      expect(success).toBe(true);
    });

    expect(result.current[0]).toHaveProperty('entity1');

    act(() => {
      unlock('entity1');
    });

    expect(result.current[0]).not.toHaveProperty('entity1');
  });

  it('should reject lock if already locked by another', () => {
    const { result } = renderHook(() => useBroadcastLock('test-channel', ejectMock, 1000));

    // Simulate another tab locking entity1
    act(() => {
      result.current[0]['entity1'] = Date.now(); // self-lock
      result.current1; // requestLock for entity2
    });

    expect(result.current[0]).toHaveProperty('entity2');

    act(() => {
      const success = result.current1; // try to lock already locked
      expect(success).toBe(false);
    });
  });

it('should force lock even if no one has locked it', () => {
  const { result } = renderHook(() => useBroadcastLock('test-channel', ejectMock, 1000));

  let success;
  act(() => {
    success = result.current2; // forceLock
  });

  expect(success).toBe(true); // ← ここは success を直接確認

  // 状態更新後の locked を確認
  expect(result.current[0]).toHaveProperty('entity2');
});

});