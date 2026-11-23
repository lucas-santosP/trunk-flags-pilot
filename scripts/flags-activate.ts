import {
  environmentFlagsPath,
  readAllEnvironmentFlags,
  readRegistry,
  writeJson,
} from './lib/flags-files.ts'
import { validateActivation } from './lib/flags-rules.ts'

function main(): void {
  const flagName = process.argv[2]
  if (!flagName) {
    console.error('Uso: bun scripts/flags-activate.ts <nomeDaFlag>')
    process.exit(1)
  }

  const registry = readRegistry()
  const environments = readAllEnvironmentFlags()
  const errors = validateActivation(registry, environments, flagName)
  if (errors.length > 0) {
    for (const error of errors) {
      console.error(error)
    }
    process.exit(1)
  }

  writeJson(environmentFlagsPath('production'), {
    ...environments.production,
    [flagName]: true,
  })
  console.log(JSON.stringify(registry[flagName]))
}

main()
