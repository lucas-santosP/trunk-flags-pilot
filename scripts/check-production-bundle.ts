import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import type { VersionInfo } from '../shared/env-manifest.ts'

const DIST = join(import.meta.dirname, '..', 'dist')

const FORBIDDEN_MARKERS = ['manifest.json', 'Mudanças por ambiente']

function listFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap(function toPaths(entry) {
    const path = join(directory, entry.name)
    return entry.isDirectory() ? listFiles(path) : [path]
  })
}

function main(): void {
  const errors: string[] = []

  if (existsSync(join(DIST, 'manifest.json'))) {
    errors.push('dist/manifest.json existe no build de produção')
  }

  const versionPath = join(DIST, 'version.json')
  if (!existsSync(versionPath)) {
    errors.push('dist/version.json não existe')
  } else {
    const versionInfo = JSON.parse(readFileSync(versionPath, 'utf8')) as VersionInfo
    if (versionInfo.environment !== 'production') {
      errors.push(`dist/version.json com environment "${versionInfo.environment}"`)
    }
  }

  const textFiles = listFiles(DIST).filter(function isText(path) {
    return /\.(js|html|css)$/.test(path)
  })
  for (const path of textFiles) {
    const content = readFileSync(path, 'utf8')
    for (const marker of FORBIDDEN_MARKERS) {
      if (content.includes(marker)) {
        errors.push(`${path} contém "${marker}": o painel de ambientes vazou para produção`)
      }
    }
  }

  if (errors.length > 0) {
    for (const error of errors) {
      console.error(`::error::${error}`)
    }
    process.exit(1)
  }
  console.log(
    `Build de produção limpo: ${textFiles.length} arquivo(s) verificados, sem painel nem manifesto.`,
  )
}

main()
