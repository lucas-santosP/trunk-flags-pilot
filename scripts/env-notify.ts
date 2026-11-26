import { readFileSync } from 'node:fs'

import type { EnvManifest } from '../shared/env-manifest.ts'
import { currentRepository, currentRunUrl, upsertMarkedComment } from './lib/github.ts'
import { homolPendingComment, parseNumbers } from './lib/notify.ts'

function main(): void {
  const manifest = JSON.parse(
    readFileSync(process.argv[2] ?? 'manifest.json', 'utf8'),
  ) as EnvManifest
  const version = process.argv[3] ?? manifest.mainSha.slice(0, 7)
  const numbers = parseNumbers(process.argv[4])
  const repository = currentRepository()
  const body = homolPendingComment(version, currentRunUrl(), manifest.included)
  for (const number of numbers) {
    upsertMarkedComment(repository, number, `<!-- env-sync:${manifest.environment} -->`, body, true)
    console.log(`#${number}: aviso de aprovação pendente`)
  }
}

main()
