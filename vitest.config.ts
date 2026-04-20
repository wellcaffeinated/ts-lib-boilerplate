import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      'ts-lib-boilerplate': new URL('./dist/index.mjs', import.meta.url)
        .pathname,
    },
  },
  test: {
    include: ['test/**/*.test.ts'],
  },
})
