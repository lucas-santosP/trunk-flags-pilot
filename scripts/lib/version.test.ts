import { describe, expect, it } from 'vitest'

import { parseCommitSubject } from '../../shared/env-manifest.ts'
import { bumpFromLabels, bumpVersion } from './version.ts'

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

describe('bumpFromLabels', () => {
  it('usa patch por padrão e respeita release:minor e release:major', () => {
    expect(bumpFromLabels(['homol'])).toBe('patch')
    expect(bumpFromLabels(['release:minor'])).toBe('minor')
    expect(bumpFromLabels(['release:minor', 'release:major'])).toBe('major')
  })
})

describe('parseCommitSubject', () => {
  it('lê squash, merge commit e commit direto', () => {
    expect(parseCommitSubject('feat: cartão (#42)', '')).toEqual({
      number: 42,
      title: 'feat: cartão',
    })
    expect(
      parseCommitSubject('Merge pull request #5 from usuario/feat/x', '\nfeat: título da PR\n'),
    ).toEqual({ number: 5, title: 'feat: título da PR' })
    expect(parseCommitSubject('chore: inicial', '')).toEqual({
      number: null,
      title: 'chore: inicial',
    })
  })
})
