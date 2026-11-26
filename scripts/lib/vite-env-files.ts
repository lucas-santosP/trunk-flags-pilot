import { readFileSync } from 'node:fs'

import type { Plugin } from 'vite'

import type { AppEnvironment, VersionInfo } from '../../shared/env-manifest.ts'

export type EnvFilesOptions = {
  environment: AppEnvironment
  version: string
  sha: string
  manifestPath: string | undefined
}

const CORS_HEADERS = ['  Access-Control-Allow-Origin: *', '  Cache-Control: no-store']

export function envFiles(options: EnvFilesOptions): Plugin {
  return {
    name: 'env-files',
    apply: 'build',
    generateBundle() {
      const versionInfo: VersionInfo = {
        environment: options.environment,
        version: options.version,
        sha: options.sha,
      }
      this.emitFile({
        type: 'asset',
        fileName: 'version.json',
        source: `${JSON.stringify(versionInfo)}\n`,
      })

      const headers = ['/version.json', ...CORS_HEADERS]

      if (options.environment !== 'production' && options.manifestPath) {
        this.emitFile({
          type: 'asset',
          fileName: 'manifest.json',
          source: readFileSync(options.manifestPath, 'utf8'),
        })
        headers.push('', '/manifest.json', ...CORS_HEADERS)
      }

      this.emitFile({ type: 'asset', fileName: '_headers', source: `${headers.join('\n')}\n` })
    },
  }
}
