import { defineConfig } from 'vitest/config';

export default defineConfig({
  define: {
    __XT_BUILD_DATE__: JSON.stringify('2026-10-24'),
    __XT_VERSION__: JSON.stringify('test'),
  },
  test: {
    include: ['src/**/*.test.ts', 'scripts/**/*.test.ts', 'tests/unit/**/*.test.ts'],
    environment: 'node',
  },
});
