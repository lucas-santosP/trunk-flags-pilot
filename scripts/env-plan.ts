import { writeFileSync } from 'node:fs'

import { ASSEMBLED_ENVIRONMENTS } from '../shared/env-manifest.ts'
import type { AssembledEnvironment } from '../shared/env-manifest.ts'
import { planEnvironment } from './lib/env-plan.ts'
import { currentRepository, fetchOpenPullRequests } from './lib/github.ts'

function parseEnvironment(value: string | undefined): AssembledEnvironment {
  const match = ASSEMBLED_ENVIRONMENTS.find(function isValue(environment) {
    return environment === value
  })
  if (!match) {
    throw new Error(`Ambiente inválido: ${String(value)}. Use dev ou homol.`)
  }
  return match
}

function main(): void {
  const environment = parseEnvironment(process.argv[2])
  const outputPath = process.argv[3] ?? 'plan.json'
  const requireApprovedReview = process.env.ENV_REQUIRE_APPROVED_REVIEW !== 'false'

  const plan = planEnvironment(fetchOpenPullRequests(currentRepository()), {
    environment,
    requireApprovedReview,
  })

  writeFileSync(outputPath, `${JSON.stringify(plan, null, 2)}\n`)
  console.log(
    `${environment}: ${plan.candidates.length} candidata(s), ${plan.skipped.length} pulada(s), ${plan.waiting.length} aguardando CI`,
  )
}

main()
