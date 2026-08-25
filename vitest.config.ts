import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['src/renderer/src/**/*.test.{ts,tsx}'],
    globals: true
  },
  resolve: {
    alias: {
      '@renderer': resolve('src/renderer/src')
    }
  }
})
