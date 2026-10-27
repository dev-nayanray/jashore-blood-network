import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.{ts,tsx}'],
  },
  resolve: {
    alias: {
      '@': new URL('./src/', import.meta.url).pathname,
      '@jbn/shared-types': new URL('../../packages/shared-types/src/index.ts', import.meta.url)
        .pathname,
      '@jbn/validation': new URL('../../packages/validation/src/index.ts', import.meta.url)
        .pathname,
    },
  },
});
