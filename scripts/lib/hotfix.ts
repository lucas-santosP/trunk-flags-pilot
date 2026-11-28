export const HOTFIX_WAIVER_PREFIX = 'Dispensado (hotfix'

export const DEFAULT_ALLOWED_ROLES = ['admin', 'maintain']

export type LabelEvent = 'labeled' | 'unlabeled'

export type HotfixAction =
  { kind: 'waive' } | { kind: 'reject' } | { kind: 'revoke' } | { kind: 'none' }

export type HotfixInput = {
  event: LabelEvent
  actorRole: string | null
  currentState: string | null
  currentDescription: string | null
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

export function waiverDescription(actor: string): string {
  return `${HOTFIX_WAIVER_PREFIX} por @${actor}): homol não exigido`
}

export function hotfixAction(input: HotfixInput, allowedRoles: string[]): HotfixAction {
  if (input.event === 'unlabeled') {
    return isWaiver(input.currentDescription) ? { kind: 'revoke' } : { kind: 'none' }
  }
  const role = input.actorRole?.toLowerCase() ?? null
  if (!role || !allowedRoles.includes(role)) {
    return { kind: 'reject' }
  }
  return input.currentState === 'success' ? { kind: 'none' } : { kind: 'waive' }
}
