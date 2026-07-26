/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    testTimeout: 15000, // 15 seconds for Kernel tests with 3s timeouts
    setupFiles: ['./vitest.setup.js'], // BroadcastChannelのモックなどをここで定義
  },
});
