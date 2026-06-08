import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    // The extension source lives under entrypoints/; tests live under tests/.
    include: ['tests/**/*.test.{ts,tsx}'],
  },
});
