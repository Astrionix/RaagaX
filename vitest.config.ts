import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    testTimeout: 15000
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '#modules': path.resolve(__dirname, './src/modules'),
      '#common': path.resolve(__dirname, './src/common')
    }
  }
})
