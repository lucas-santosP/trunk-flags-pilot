import { describe, expect, it } from 'vitest'

import { hotfixAction, parseAllowedRoles, waiverDescription } from './hotfix.ts'

const ROLES: Record<string, string> = { lider: 'maintain', dona: 'admin', dev: 'write' }

function roleOf(login: string): string | null {
  return ROLES[login] ?? null
}

const allowed = parseAllowedRoles(undefined)

describe('hotfixAction', () => {
  it('dispensa homol quando quem aplicou o label tem permissão', () => {
    const action = hotfixAction(
      {
        labels: ['hotfix'],
        hotfixLabeledBy: 'lider',
        currentDescription: null,
        currentState: null,
      },
      roleOf,
      allowed,
    )
    expect(action).toEqual({ kind: 'waive', by: 'lider' })
  })

  it('recusa quando quem aplicou o label não tem permissão', () => {
    const action = hotfixAction(
      { labels: ['hotfix'], hotfixLabeledBy: 'dev', currentDescription: null, currentState: null },
      roleOf,
      allowed,
    )
    expect(action).toEqual({ kind: 'reject', by: 'dev' })
  })

  it('não repete a dispensa no mesmo commit', () => {
    const action = hotfixAction(
      {
        labels: ['hotfix'],
        hotfixLabeledBy: 'dona',
        currentDescription: waiverDescription('dona'),
        currentState: 'success',
      },
      roleOf,
      allowed,
    )
    expect(action).toEqual({ kind: 'none' })
  })

  it('revoga a dispensa quando o label sai', () => {
    const action = hotfixAction(
      {
        labels: [],
        hotfixLabeledBy: 'dona',
        currentDescription: waiverDescription('dona'),
        currentState: 'success',
      },
      roleOf,
      allowed,
    )
    expect(action).toEqual({ kind: 'revoke' })
  })

  it('ignora PRs sem hotfix e sem dispensa', () => {
    const action = hotfixAction(
      {
        labels: ['homol'],
        hotfixLabeledBy: null,
        currentDescription: 'Incluída no deploy de homol',
        currentState: 'success',
      },
      roleOf,
      allowed,
    )
    expect(action).toEqual({ kind: 'none' })
  })
})

describe('hotfix junto com homol', () => {
  it('não sobrescreve o status quando a PR já está verde em homol', () => {
    const action = hotfixAction(
      {
        labels: ['hotfix', 'homol'],
        hotfixLabeledBy: 'lider',
        currentDescription: 'Incluída no deploy de homol',
        currentState: 'success',
      },
      roleOf,
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
