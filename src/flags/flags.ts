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

export type FlagMatrixRow = {
  name: string
  dev: boolean
  homol: boolean
  production: boolean
}

export function listFlagMatrix(): FlagMatrixRow[] {
  return Object.keys(__FLAG_MATRIX__.dev).map(function toRow(name) {
    return {
      name,
      dev: __FLAG_MATRIX__.dev[name] === true,
      homol: __FLAG_MATRIX__.homol[name] === true,
      production: __FLAG_MATRIX__.production[name] === true,
    }
  })
}
