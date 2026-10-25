import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.spec.ts'],
    globals: false,
  },
  resolve: {
    alias: {
      '@jbn/shared-types': new URL('../../packages/shared-types/src/index.ts', import.meta.url)
        .pathname,
      '@jbn/validation': new URL('../../packages/validation/src/index.ts', import.meta.url)
        .pathname,
    },
  },
});
