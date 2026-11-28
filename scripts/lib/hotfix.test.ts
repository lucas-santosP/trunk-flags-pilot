import { describe, expect, it } from 'vitest'

import type { HotfixInput } from './hotfix.ts'
import { hotfixAction, parseAllowedRoles, waiverDescription } from './hotfix.ts'

const allowed = parseAllowedRoles(undefined)

function input(partial: Partial<HotfixInput>): HotfixInput {
  return {
    event: 'labeled',
    actorRole: 'maintain',
    currentState: null,
    currentDescription: null,
    ...partial,
  }
}

describe('hotfixAction', () => {
  it('dispensa homol quando quem aplicou o label tem permissão', () => {
    expect(hotfixAction(input({}), allowed)).toEqual({ kind: 'waive' })
    expect(hotfixAction(input({ actorRole: 'admin' }), allowed)).toEqual({ kind: 'waive' })
  })

  it('recusa quando quem aplicou o label não tem permissão', () => {
    expect(hotfixAction(input({ actorRole: 'write' }), allowed)).toEqual({ kind: 'reject' })
    expect(hotfixAction(input({ actorRole: null }), allowed)).toEqual({ kind: 'reject' })
  })

  it('não sobrescreve o status quando a PR já está verde (ex.: também em homol)', () => {
    const action = hotfixAction(
      input({ currentState: 'success', currentDescription: 'Incluída no deploy de homol' }),
      allowed,
    )
    expect(action).toEqual({ kind: 'none' })
  })

  it('revoga a dispensa quando o label sai', () => {
    const action = hotfixAction(
      input({
        event: 'unlabeled',
        currentState: 'success',
        currentDescription: waiverDescription('lider'),
      }),
      allowed,
    )
    expect(action).toEqual({ kind: 'revoke' })
  })

  it('não mexe no status de homol de verdade quando o label sai', () => {
    const action = hotfixAction(
      input({
        event: 'unlabeled',
        currentState: 'success',
        currentDescription: 'Incluída no deploy de homol',
      }),
      allowed,
    )
    expect(action).toEqual({ kind: 'none' })
  })
})

describe('parseAllowedRoles', () => {
  it('usa admin e maintain por padrão', () => {
    expect(parseAllowedRoles('')).toEqual(['admin', 'maintain'])
    expect(parseAllowedRoles(' Admin ,write')).toEqual(['admin', 'write'])
  })
})
