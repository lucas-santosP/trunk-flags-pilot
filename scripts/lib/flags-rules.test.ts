import { describe, expect, it } from 'vitest'

import type { Registry } from './flags-files.ts'
import {
  bumpVersion,
  findStaleFlags,
  validateActivation,
  validateConsistency,
  validatePullRequest,
} from './flags-rules.ts'

const registry: Registry = {
  novoCheckout: { type: 'release', owner: 'dev', created: '2026-11-01', description: 'x' },
  killSwitch: { type: 'ops', owner: 'dev', created: '2026-11-01', description: 'x' },
}

describe('validateConsistency', () => {
  it('aceita ambientes com as mesmas flags do registry', () => {
    const flags = { novoCheckout: true, killSwitch: false }
    expect(validateConsistency(registry, { dev: flags, homol: flags, production: flags })).toEqual(
      [],
    )
  })

  it('acusa flag faltando em um ambiente e flag fora do registry', () => {
    const errors = validateConsistency(registry, {
      dev: { novoCheckout: true, killSwitch: false },
      homol: { novoCheckout: true, killSwitch: false },
      production: { killSwitch: false, fantasma: true },
    })
    expect(errors).toHaveLength(2)
  })
})

describe('validatePullRequest', () => {
  it('bloqueia flag nova nascendo true em produção', () => {
    const errors = validatePullRequest({
      baseProduction: {},
      headProduction: { novoCheckout: true },
      changedFiles: ['flags/production.json', 'src/app.tsx'],
    })
    expect(errors.join()).toContain('precisa nascer false')
  })

  it('bloqueia ativação em produção junto com código', () => {
    const errors = validatePullRequest({
      baseProduction: { novoCheckout: false },
      headProduction: { novoCheckout: true },
      changedFiles: ['flags/production.json', 'src/app.tsx'],
    })
    expect(errors.join()).toContain('PR isolada')
  })

  it('aceita ativação isolada em produção', () => {
    expect(
      validatePullRequest({
        baseProduction: { novoCheckout: false },
        headProduction: { novoCheckout: true },
        changedFiles: ['flags/production.json'],
      }),
    ).toEqual([])
  })

  it('aceita remoção de flag junto com código', () => {
    expect(
      validatePullRequest({
        baseProduction: { novoCheckout: true },
        headProduction: {},
        changedFiles: ['flags/production.json', 'src/app.tsx'],
      }),
    ).toEqual([])
  })
})

describe('findStaleFlags', () => {
  const allOn = { novoCheckout: true, killSwitch: true }
  const environments = { dev: allOn, homol: allOn, production: allOn }

  it('lista release flag ligada em tudo há mais dias que o mínimo e ignora ops', () => {
    const stale = findStaleFlags(
      registry,
      environments,
      { novoCheckout: '2026-11-01T00:00:00Z', killSwitch: '2026-10-01T00:00:00Z' },
      new Date('2026-11-20T00:00:00Z'),
      14,
    )
    expect(stale).toEqual([
      { name: 'novoCheckout', enabledSince: '2026-11-01T00:00:00Z', days: 19 },
    ])
  })

  it('ignora flag ligada há menos dias que o mínimo', () => {
    const stale = findStaleFlags(
      registry,
      environments,
      { novoCheckout: '2026-11-15T00:00:00Z' },
      new Date('2026-11-20T00:00:00Z'),
      14,
    )
    expect(stale).toEqual([])
  })
})

describe('bumpVersion', () => {
  it('calcula a primeira versão sem tag anterior', () => {
    expect(bumpVersion(null, 'patch')).toBe('v0.0.1')
    expect(bumpVersion(null, 'minor')).toBe('v0.1.0')
  })

  it('incrementa patch, minor e major', () => {
    expect(bumpVersion('v1.4.2', 'patch')).toBe('v1.4.3')
    expect(bumpVersion('v1.4.2', 'minor')).toBe('v1.5.0')
    expect(bumpVersion('v1.4.2', 'major')).toBe('v2.0.0')
  })

  it('rejeita tag fora do padrão', () => {
    expect(() => bumpVersion('release-1', 'patch')).toThrow()
  })
})

describe('validateActivation', () => {
  const environments = {
    dev: { novoCheckout: true, killSwitch: false },
    homol: { novoCheckout: true, killSwitch: false },
    production: { novoCheckout: false, killSwitch: false },
  }

  it('aceita release flag ligada em homol e desligada em produção', () => {
    expect(validateActivation(registry, environments, 'novoCheckout')).toEqual([])
  })

  it('recusa flag inexistente', () => {
    expect(validateActivation(registry, environments, 'fantasma')).toHaveLength(1)
  })

  it('recusa ops flag e flag não validada em homol', () => {
    expect(validateActivation(registry, environments, 'killSwitch')).toHaveLength(2)
  })

  it('recusa flag já ligada em produção', () => {
    const active = { ...environments, production: { novoCheckout: true, killSwitch: false } }
    expect(validateActivation(registry, active, 'novoCheckout').join()).toContain('já está ligada')
  })
})
