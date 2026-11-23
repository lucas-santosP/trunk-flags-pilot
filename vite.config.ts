import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

import { readEnvironmentFlags, resolveEnvironment } from './scripts/lib/flags-files.ts'

export default defineConfig(function createConfig({ mode }) {
  const environment = resolveEnvironment(mode)

  return {
    plugins: [react(), tailwindcss()],
    define: {
      __APP_ENV__: JSON.stringify(environment),
      __APP_VERSION__: JSON.stringify(process.env.APP_VERSION ?? 'local'),
      __COMMIT_SHA__: JSON.stringify(process.env.COMMIT_SHA ?? 'local'),
      __FLAGS__: JSON.stringify(readEnvironmentFlags(environment)),
    },
    test: {
      environment: 'jsdom',
      include: ['src/**/*.test.{ts,tsx}', 'scripts/**/*.test.ts'],
    },
  }
})
