import { HOTFIX_LABEL } from './env-plan.ts'

export const HOTFIX_WAIVER_PREFIX = 'Dispensado (hotfix'

export const DEFAULT_ALLOWED_ROLES = ['admin', 'maintain']

export type HotfixAction =
  | { kind: 'waive'; by: string }
  | { kind: 'reject'; by: string | null }
  | { kind: 'revoke' }
  | { kind: 'none' }

export type HotfixInput = {
  labels: string[]
  hotfixLabeledBy: string | null
  currentDescription: string | null
  currentState: string | null
}

export function parseAllowedRoles(value: string | undefined): string[] {
  const roles = (value ?? '')
    .split(',')
    .map(function normalize(role) {
      return role.trim().toLowerCase()
    })
    .filter(Boolean)
  return roles.length > 0 ? roles : DEFAULT_ALLOWED_ROLES
}

export function isWaiver(description: string | null): boolean {
  return description?.startsWith(HOTFIX_WAIVER_PREFIX) ?? false
}

export function waiverDescription(by: string): string {
  return `${HOTFIX_WAIVER_PREFIX} por @${by}): homol não exigido`
}

export function hotfixAction(
  input: HotfixInput,
  roleOf: (login: string) => string | null,
  allowedRoles: string[],
): HotfixAction {
  if (!input.labels.includes(HOTFIX_LABEL)) {
    return isWaiver(input.currentDescription) ? { kind: 'revoke' } : { kind: 'none' }
  }
  const by = input.hotfixLabeledBy
  const role = by ? roleOf(by) : null
  if (!by || !role || !allowedRoles.includes(role.toLowerCase())) {
    return { kind: 'reject', by }
  }
  return input.currentState === 'success' ? { kind: 'none' } : { kind: 'waive', by }
}
