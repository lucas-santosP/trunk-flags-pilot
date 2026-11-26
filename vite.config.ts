import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

import type { EnvPanelConfig } from './shared/env-manifest.ts'
import { environmentUrls, resolveEnvironment } from './scripts/lib/environment.ts'
import { readMainHistory } from './scripts/lib/git.ts'
import { envFiles } from './scripts/lib/vite-env-files.ts'

const HISTORY_LIMIT = 40

function repositoryUrl(): string | null {
  const repository = process.env.GITHUB_REPOSITORY
  if (!repository) {
    return null
  }
  return `${process.env.GITHUB_SERVER_URL ?? 'https://github.com'}/${repository}`
}

function panelConfig(): EnvPanelConfig {
  return {
    urls: environmentUrls(process.env.CF_PAGES_PROJECT),
    repositoryUrl: repositoryUrl(),
    history: readMainHistory(process.env.MAIN_SHA ?? 'HEAD', HISTORY_LIMIT),
  }
}

export default defineConfig(function createConfig({ mode }) {
  const environment = resolveEnvironment(mode)
  const isProduction = environment === 'production'
  const version = process.env.APP_VERSION ?? 'local'
  const sha = process.env.COMMIT_SHA ?? 'local'

  return {
    plugins: [
      react(),
      tailwindcss(),
      envFiles({
        environment,
        version,
        sha,
        manifestPath: isProduction ? undefined : process.env.ENV_MANIFEST_FILE,
      }),
    ],
    define: {
      __APP_ENV__: JSON.stringify(environment),
      __APP_VERSION__: JSON.stringify(version),
      __COMMIT_SHA__: JSON.stringify(sha),
      __ENV_PANEL__: isProduction ? 'null' : JSON.stringify(panelConfig()),
    },
    test: {
      environment: 'jsdom',
      include: ['src/**/*.test.{ts,tsx}', 'scripts/**/*.test.ts', 'shared/**/*.test.ts'],
    },
  }
})
