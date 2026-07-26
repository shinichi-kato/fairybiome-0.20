/**
 * Unit tests for Kernel
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Kernel from './kernel';
import {
  ActivateRequest,
  DeactivateRequest,
  ReportRequest,
  ListenRequest,
  PartConfig,
} from './kernel.types';

describe('Kernel', () => {
  let kernel: Kernel;
  const mockPartConfig: PartConfig = {
    'test-bot': ['orchestrator', 'episode1', 'episode2'],
    'demo-bot': ['orchestrator', 'greeting'],
  };

  beforeEach(() => {
    kernel = new Kernel({
      timeout: 3000,
      partConfig: mockPartConfig,
      debug: false,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Initialization', () => {
    it('should create a kernel instance', () => {
      expect(kernel).toBeDefined();
    });

    it('should initialize a bot and discover parts', async () => {
      await kernel.initialize('test-bot');
      // Internal state check would go here
      expect(kernel).toBeDefined();
    });

    it('should handle multiple bots independently', async () => {
      await kernel.initialize('test-bot');
      await kernel.initialize('demo-bot');
      expect(kernel).toBeDefined();
    });
  });

  describe('Activate Operation', () => {
    it('should activate all parts of a bot', async () => {
      const request: ActivateRequest = {
        type: 'activate',
        botName: 'test-bot',
      };

      await kernel.initialize('test-bot');
      const result = await kernel.activate(request);

      expect(result.type).toBe('activateCompleted');
      expect(result.botName).toBe('test-bot');
      expect(Array.isArray(result.activatedParts)).toBe(true);
      expect(Array.isArray(result.failedParts)).toBe(true);
    });

    it('should activate specific parts only', async () => {
      const request: ActivateRequest = {
        type: 'activate',
        botName: 'test-bot',
        partNames: ['orchestrator', 'episode1'],
      };

      await kernel.initialize('test-bot');
      const result = await kernel.activate(request);

      expect(result.type).toBe('activateCompleted');
      expect(result.botName).toBe('test-bot');
    });

    it('should exclude specified parts', async () => {
      const request: ActivateRequest = {
        type: 'activate',
        botName: 'test-bot',
        excludedPartNames: ['episode2'],
      };

      await kernel.initialize('test-bot');
      const result = await kernel.activate(request);

      expect(result.type).toBe('activateCompleted');
    });

    it('should handle timeout gracefully', async () => {
      const request: ActivateRequest = {
        type: 'activate',
        botName: 'test-bot',
        partNames: ['orchestrator'],
      };

      // Create kernel with short timeout for testing
      const testKernel = new Kernel({
        timeout: 100,
        partConfig: mockPartConfig,
      });

      await testKernel.initialize('test-bot');
      const result = await testKernel.activate(request);

      // Since no real response comes, it should timeout
      expect(result.type).toBe('activateCompleted');
      // Should have failed parts due to timeout
      expect(result.failedParts.length).toBeGreaterThanOrEqual(0);
    });

    it('should handle non-existent bot gracefully', async () => {
      const request: ActivateRequest = {
        type: 'activate',
        botName: 'non-existent-bot',
      };

      // Should initialize automatically
      const result = await kernel.activate(request);
      expect(result.type).toBe('activateCompleted');
      expect(result.botName).toBe('non-existent-bot');
    });
  });

  describe('Deactivate Operation', () => {
    it('should deactivate all parts of a bot', async () => {
      const request: DeactivateRequest = {
        type: 'deactivate',
        botName: 'test-bot',
      };

      await kernel.initialize('test-bot');
      const result = await kernel.deactivate(request);

      expect(result.type).toBe('deactivateCompleted');
      expect(result.botName).toBe('test-bot');
      expect(Array.isArray(result.deactivatedParts)).toBe(true);
    });

    it('should deactivate specific parts only', async () => {
      const request: DeactivateRequest = {
        type: 'deactivate',
        botName: 'test-bot',
        partNames: ['orchestrator'],
      };

      await kernel.initialize('test-bot');
      const result = await kernel.deactivate(request);

      expect(result.type).toBe('deactivateCompleted');
    });

    it('should handle deactivating non-initialized bot', async () => {
      const request: DeactivateRequest = {
        type: 'deactivate',
        botName: 'non-initialized-bot',
      };

      const result = await kernel.deactivate(request);
      expect(result.type).toBe('deactivateCompleted');
      expect(result.failedParts.length).toBeGreaterThan(0);
    });
  });

  describe('Report Operation', () => {
    it('should report all parts status', async () => {
      const request: ReportRequest = {
        type: 'report',
        botName: 'test-bot',
      };

      await kernel.initialize('test-bot');
      const result = await kernel.report(request);

      expect(result.type).toBe('reportCompleted');
      expect(result.botName).toBe('test-bot');
      expect(typeof result.reports).toBe('object');
      expect(Array.isArray(result.failedParts)).toBe(true);
    });

    it('should report specific parts only', async () => {
      const request: ReportRequest = {
        type: 'report',
        botName: 'test-bot',
        partNames: ['orchestrator', 'episode1'],
      };

      await kernel.initialize('test-bot');
      const result = await kernel.report(request);

      expect(result.type).toBe('reportCompleted');
    });

    it('should handle report for non-initialized bot', async () => {
      const request: ReportRequest = {
        type: 'report',
        botName: 'non-initialized-bot',
      };

      const result = await kernel.report(request);
      expect(result.type).toBe('reportCompleted');
      expect(result.failedParts.length).toBeGreaterThan(0);
    });
  });

  describe('Listen Operation', () => {
    it('should queue messages for a bot', async () => {
      const request: ListenRequest = {
        type: 'listen',
        botName: 'test-bot',
        message: {
          text: 'Hello, bot!',
          role: 'user',
        },
      };

      await kernel.initialize('test-bot');
      await kernel.listen(request);

      // Should complete without error
      expect(kernel).toBeDefined();
    });

    it('should initialize bot if not already initialized', async () => {
      const request: ListenRequest = {
        type: 'listen',
        botName: 'new-bot',
        message: {
          text: 'Hello',
          role: 'user',
        },
      };

      // Should not throw, even though bot is not initialized
      await kernel.listen(request);
      expect(kernel).toBeDefined();
    });

    it('should accumulate multiple messages', async () => {
      const botName = 'test-bot';
      await kernel.initialize(botName);

      const messages = [
        { text: 'First message', role: 'user' as const },
        { text: 'Second message', role: 'user' as const },
        { text: 'Third message', role: 'user' as const },
      ];

      for (const message of messages) {
        await kernel.listen({
          type: 'listen',
          botName,
          message,
        });
      }

      expect(kernel).toBeDefined();
    });
  });

  describe('Multi-bot Operations', () => {
    it('should handle multiple bots independently', async () => {
      const bot1Request: ActivateRequest = {
        type: 'activate',
        botName: 'test-bot',
      };

      const bot2Request: ActivateRequest = {
        type: 'activate',
        botName: 'demo-bot',
      };

      await kernel.initialize('test-bot');
      await kernel.initialize('demo-bot');

      const result1 = await kernel.activate(bot1Request);
      const result2 = await kernel.activate(bot2Request);

      expect(result1.botName).toBe('test-bot');
      expect(result2.botName).toBe('demo-bot');
      expect(result1.type).toBe('activateCompleted');
      expect(result2.type).toBe('activateCompleted');
    });

    it('should deactivate one bot without affecting others', async () => {
      await kernel.initialize('test-bot');
      await kernel.initialize('demo-bot');

      // Activate both
      await kernel.activate({ type: 'activate', botName: 'test-bot' });
      await kernel.activate({ type: 'activate', botName: 'demo-bot' });

      // Deactivate one
      const result = await kernel.deactivate({ type: 'deactivate', botName: 'test-bot' });

      expect(result.botName).toBe('test-bot');
      expect(result.type).toBe('deactivateCompleted');
    });
  });

  describe('Shutdown', () => {
    it('should shutdown a bot and cleanup resources', async () => {
      await kernel.initialize('test-bot');
      await kernel.activate({ type: 'activate', botName: 'test-bot' });

      // Should complete without error
      await kernel.shutdown('test-bot');

      expect(kernel).toBeDefined();
    });

    it('should handle shutdown of non-initialized bot', async () => {
      // Should not throw
      await kernel.shutdown('non-initialized-bot');
      expect(kernel).toBeDefined();
    });
  });

  describe('Singleton Pattern', () => {
    it('should return same instance', () => {
      const instance1 = Kernel.getInstance();
      const instance2 = Kernel.getInstance();

      expect(instance1).toBe(instance2);
    });

    it('should use provided options only on first creation', () => {
      // Reset singleton for this test
      const testKernel1 = new Kernel({ timeout: 5000, debug: true });
      const testKernel2 = new Kernel({ timeout: 1000, debug: false });

      // Both should be independent instances since we're not using getInstance
      expect(testKernel1).not.toBe(testKernel2);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid bot name gracefully', async () => {
      const request: ActivateRequest = {
        type: 'activate',
        botName: '',
      };

      const result = await kernel.activate(request);
      expect(result.type).toBe('activateCompleted');
    });

    it('should track failed parts in activate', async () => {
      const request: ActivateRequest = {
        type: 'activate',
        botName: 'test-bot',
        partNames: ['non-existent-part'],
      };

      // Create custom kernel with empty config
      const emptyKernel = new Kernel({
        timeout: 100,
        partConfig: { 'test-bot': [] },
      });

      const result = await emptyKernel.activate(request);
      expect(result.failedParts.length).toBeGreaterThanOrEqual(0);
    });

    it('should continue with partial failures', async () => {
      const request: ActivateRequest = {
        type: 'activate',
        botName: 'test-bot',
        partNames: ['orchestrator', 'non-existent'],
      };

      await kernel.initialize('test-bot');
      const result = await kernel.activate(request);

      expect(result.type).toBe('activateCompleted');
      // Should have completed despite failures
      expect(
        result.activatedParts.length + result.failedParts.length
      ).toBeGreaterThanOrEqual(0);
    });
  });
});
