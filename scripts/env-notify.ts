import { readFileSync } from 'node:fs'

import type { EnvManifest } from '../shared/env-manifest.ts'
import { writeStage } from './lib/card-writer.ts'
import { currentRepository, currentRunUrl } from './lib/github.ts'
import { parseNumbers } from './lib/notify.ts'

function main(): void {
  const manifest = JSON.parse(
    readFileSync(process.argv[2] ?? 'manifest.json', 'utf8'),
  ) as EnvManifest
  const version = process.argv[3] ?? manifest.mainSha.slice(0, 7)
  const numbers = parseNumbers(process.argv[4])
  const repository = currentRepository()
  const included = manifest.included
    .map(function toReference(pullRequest) {
      return `#${pullRequest.number}`
    })
    .join(', ')
  for (const number of numbers) {
    writeStage(
      repository,
      number,
      manifest.environment,
      {
        kind: 'approval',
        text: `aguardando aprovação do deploy \`${version}\` · [Revisar e aprovar](${currentRunUrl()}) · entram: ${included}`,
      },
      true,
    )
    console.log(`#${number}: aviso de aprovação pendente`)
  }
}

main()
