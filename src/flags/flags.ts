export type FlagName = keyof typeof import('../../flags/registry.json')

const enabledFlags: Readonly<Record<string, boolean>> = __FLAGS__

export function isFlagEnabled(name: FlagName): boolean {
  return enabledFlags[name] === true
}

export function useFlag(name: FlagName): boolean {
  return isFlagEnabled(name)
}

export function listFlags(): Array<[string, boolean]> {
  return Object.entries(enabledFlags)
}
