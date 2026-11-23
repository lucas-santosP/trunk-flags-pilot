import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

export const ENVIRONMENTS = ['dev', 'homol', 'production'] as const

export type Environment = (typeof ENVIRONMENTS)[number]

export type FlagType = 'release' | 'ops'

export type FlagMetadata = {
  type: FlagType
  owner: string
  created: string
  description: string
}

export type Registry = Record<string, FlagMetadata>

export type EnvironmentFlags = Record<string, boolean>

export const FLAGS_DIR = join(import.meta.dirname, '..', '..', 'flags')

export const REGISTRY_PATH = join(FLAGS_DIR, 'registry.json')

export function environmentFlagsPath(environment: Environment): string {
  return join(FLAGS_DIR, `${environment}.json`)
}

export function resolveEnvironment(mode: string): Environment {
  if (mode === 'homol' || mode === 'production') {
    return mode
  }
  return 'dev'
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T
}

export function writeJson(path: string, value: unknown): void {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`)
}

export function readRegistry(): Registry {
  return readJson<Registry>(REGISTRY_PATH)
}

export function readEnvironmentFlags(environment: Environment): EnvironmentFlags {
  return readJson<EnvironmentFlags>(environmentFlagsPath(environment))
}

export function readAllEnvironmentFlags(): Record<Environment, EnvironmentFlags> {
  return {
    dev: readEnvironmentFlags('dev'),
    homol: readEnvironmentFlags('homol'),
    production: readEnvironmentFlags('production'),
  }
}
