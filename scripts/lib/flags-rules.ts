import { ENVIRONMENTS } from './flags-files.ts'
import type { Environment, EnvironmentFlags, Registry } from './flags-files.ts'

const PRODUCTION_FLAGS_FILE = 'flags/production.json'

const DAY_IN_MS = 24 * 60 * 60 * 1000

export function validateConsistency(
  registry: Registry,
  environments: Record<Environment, EnvironmentFlags>,
): string[] {
  const errors: string[] = []
  const registered = new Set(Object.keys(registry))

  for (const [name, metadata] of Object.entries(registry)) {
    if (metadata.type !== 'release' && metadata.type !== 'ops') {
      errors.push(`registry: flag "${name}" com type inválido "${String(metadata.type)}"`)
    }
    if (!metadata.owner || !metadata.created || !metadata.description) {
      errors.push(`registry: flag "${name}" precisa de owner, created e description`)
    }
  }

  for (const environment of ENVIRONMENTS) {
    const flags = environments[environment]
    for (const name of registered) {
      if (!(name in flags)) {
        errors.push(`${environment}.json: flag "${name}" está no registry mas não neste ambiente`)
      }
    }
    for (const [name, value] of Object.entries(flags)) {
      if (!registered.has(name)) {
        errors.push(`${environment}.json: flag "${name}" não existe no registry`)
      }
      if (typeof value !== 'boolean') {
        errors.push(`${environment}.json: flag "${name}" precisa ser true ou false`)
      }
    }
  }

  return errors
}

export type PullRequestInput = {
  baseProduction: EnvironmentFlags
  headProduction: EnvironmentFlags
  changedFiles: string[]
}

export function findProductionActivations(
  baseProduction: EnvironmentFlags,
  headProduction: EnvironmentFlags,
): string[] {
  return Object.entries(headProduction)
    .filter(function isActivation([name, value]) {
      return value === true && name in baseProduction && baseProduction[name] === false
    })
    .map(function toName([name]) {
      return name
    })
}

export function validatePullRequest(input: PullRequestInput): string[] {
  const errors: string[] = []

  for (const [name, value] of Object.entries(input.headProduction)) {
    if (!(name in input.baseProduction) && value === true) {
      errors.push(
        `production.json: flag nova "${name}" precisa nascer false em produção. Ative em uma PR separada.`,
      )
    }
  }

  const activations = findProductionActivations(input.baseProduction, input.headProduction)
  const otherFiles = input.changedFiles.filter(function isNotProductionFlags(file) {
    return file !== PRODUCTION_FLAGS_FILE
  })

  if (activations.length > 0 && otherFiles.length > 0) {
    errors.push(
      `Ativação em produção (${activations.join(', ')}) deve ser uma PR isolada que altera apenas ${PRODUCTION_FLAGS_FILE}. Arquivos extras: ${otherFiles.join(', ')}`,
    )
  }

  return errors
}

export type StaleFlag = {
  name: string
  enabledSince: string
  days: number
}

export function findStaleFlags(
  registry: Registry,
  environments: Record<Environment, EnvironmentFlags>,
  productionEnabledSince: Record<string, string>,
  now: Date,
  minDays: number,
): StaleFlag[] {
  const stale: StaleFlag[] = []

  for (const [name, metadata] of Object.entries(registry)) {
    if (metadata.type !== 'release') {
      continue
    }
    const enabledEverywhere = ENVIRONMENTS.every(function isEnabled(environment) {
      return environments[environment][name] === true
    })
    const enabledSince = productionEnabledSince[name]
    if (!enabledEverywhere || !enabledSince) {
      continue
    }
    const days = Math.floor((now.getTime() - new Date(enabledSince).getTime()) / DAY_IN_MS)
    if (days >= minDays) {
      stale.push({ name, enabledSince, days })
    }
  }

  return stale
}

export type Bump = 'patch' | 'minor' | 'major'

export function bumpVersion(currentTag: string | null, bump: Bump): string {
  if (!currentTag) {
    return bump === 'major' ? 'v1.0.0' : bump === 'minor' ? 'v0.1.0' : 'v0.0.1'
  }
  const match = /^v(\d+)\.(\d+)\.(\d+)$/.exec(currentTag)
  if (!match) {
    throw new Error(`Tag fora do padrão vX.Y.Z: ${currentTag}`)
  }
  const [major, minor, patch] = match.slice(1).map(Number)
  if (bump === 'major') {
    return `v${major + 1}.0.0`
  }
  if (bump === 'minor') {
    return `v${major}.${minor + 1}.0`
  }
  return `v${major}.${minor}.${patch + 1}`
}

export function validateActivation(
  registry: Registry,
  environments: Record<Environment, EnvironmentFlags>,
  flagName: string,
): string[] {
  const metadata = registry[flagName]
  if (!metadata) {
    return [`flag "${flagName}" não existe em flags/registry.json`]
  }
  const errors: string[] = []
  if (metadata.type !== 'release') {
    errors.push(`flag "${flagName}" é do tipo "${metadata.type}": ative manualmente`)
  }
  if (environments.production[flagName] !== false) {
    errors.push(`flag "${flagName}" já está ligada em produção`)
  }
  if (environments.homol[flagName] !== true) {
    errors.push(
      `flag "${flagName}" não está ligada em homol: valide em homol antes de ativar em produção`,
    )
  }
  return errors
}
