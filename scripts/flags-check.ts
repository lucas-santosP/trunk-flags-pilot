import { readAllEnvironmentFlags, readEnvironmentFlags, readRegistry } from './lib/flags-files.ts'
import type { EnvironmentFlags } from './lib/flags-files.ts'
import { validateConsistency, validatePullRequest } from './lib/flags-rules.ts'
import { changedFilesSince, readFileAtRef } from './lib/git.ts'

function main(): void {
  const errors = validateConsistency(readRegistry(), readAllEnvironmentFlags())

  const baseRef = process.env.BASE_REF
  if (baseRef) {
    errors.push(
      ...validatePullRequest({
        baseProduction: readFileAtRef<EnvironmentFlags>(baseRef, 'flags/production.json', {}),
        headProduction: readEnvironmentFlags('production'),
        changedFiles: changedFilesSince(baseRef),
      }),
    )
  }

  if (errors.length > 0) {
    console.error('Flags inválidas:')
    for (const error of errors) {
      console.error(`  - ${error}`)
    }
    process.exit(1)
  }

  console.log(baseRef ? `Flags OK (comparado com ${baseRef})` : 'Flags OK')
}

main()
