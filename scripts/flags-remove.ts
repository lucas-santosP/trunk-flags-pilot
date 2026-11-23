import { join } from 'node:path'

import { Project } from 'ts-morph'

import {
  ENVIRONMENTS,
  REGISTRY_PATH,
  environmentFlagsPath,
  readEnvironmentFlags,
  readRegistry,
  writeJson,
} from './lib/flags-files.ts'
import { removeFlagFromProject } from './lib/remove-flag.ts'

function removeFromJsonFiles(flagName: string): void {
  const registry = readRegistry()
  if (!(flagName in registry)) {
    console.error(`Flag "${flagName}" não existe em flags/registry.json`)
    process.exit(1)
  }
  if (registry[flagName].type !== 'release') {
    console.error(
      `Flag "${flagName}" é do tipo "${registry[flagName].type}" e não deve ser removida automaticamente`,
    )
    process.exit(1)
  }

  delete registry[flagName]
  writeJson(REGISTRY_PATH, registry)

  for (const environment of ENVIRONMENTS) {
    const flags = readEnvironmentFlags(environment)
    delete flags[flagName]
    writeJson(environmentFlagsPath(environment), flags)
  }
}

function main(): void {
  const flagName = process.argv[2]
  if (!flagName) {
    console.error('Uso: bun scripts/flags-remove.ts <nomeDaFlag>')
    process.exit(1)
  }

  removeFromJsonFiles(flagName)

  const project = new Project({
    tsConfigFilePath: join(import.meta.dirname, '..', 'tsconfig.app.json'),
  })
  const report = removeFlagFromProject(project, flagName)
  project.saveSync()

  console.log(`Flag "${flagName}" removida dos JSONs.`)
  for (const file of report.changedFiles) {
    console.log(`  alterado: ${file}`)
  }
  for (const file of report.deletedFiles) {
    console.log(`  removido: ${file}`)
  }
  console.log(
    'Rode typecheck, lint e testes: o tsc aponta qualquer uso que o codemod não conseguiu resolver.',
  )
}

main()
