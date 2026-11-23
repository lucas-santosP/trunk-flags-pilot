import { readAllEnvironmentFlags, readRegistry } from './lib/flags-files.ts'
import type { EnvironmentFlags } from './lib/flags-files.ts'
import { findStaleFlags } from './lib/flags-rules.ts'
import { commitsTouching, readFileAtRef } from './lib/git.ts'

const PRODUCTION_PATH = 'flags/production.json'

function productionEnabledSince(): Record<string, string> {
  const commits = commitsTouching(PRODUCTION_PATH)
  const current = readFileAtRef<EnvironmentFlags>('HEAD', PRODUCTION_PATH, {})
  const enabledSince: Record<string, string> = {}

  for (const [name, value] of Object.entries(current)) {
    if (value !== true) {
      continue
    }
    for (const commit of commits) {
      const snapshot = readFileAtRef<EnvironmentFlags>(commit.sha, PRODUCTION_PATH, {})
      if (snapshot[name] !== true) {
        break
      }
      enabledSince[name] = commit.date
    }
  }

  return enabledSince
}

function parseMinDays(): number {
  const argument = process.argv.find(function isMinDays(item) {
    return item.startsWith('--min-days=')
  })
  return argument ? Number(argument.split('=')[1]) : 14
}

function main(): void {
  const stale = findStaleFlags(
    readRegistry(),
    readAllEnvironmentFlags(),
    productionEnabledSince(),
    new Date(),
    parseMinDays(),
  )

  if (process.argv.includes('--json')) {
    console.log(JSON.stringify(stale))
    return
  }

  if (stale.length === 0) {
    console.log('Nenhuma flag pronta para remoção.')
    return
  }

  for (const flag of stale) {
    console.log(
      `${flag.name}: ligada em produção há ${flag.days} dias (desde ${flag.enabledSince})`,
    )
  }
}

main()
