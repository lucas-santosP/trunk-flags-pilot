import { describe, expect, it } from 'vitest'

import type { EnvManifest } from '../../shared/env-manifest.ts'
import { evaluateApproval } from './env-approval.ts'

function pr(number: number, headSha: string) {
  return { number, title: `PR ${number}`, url: `u/${number}`, headSha }
}

function manifest(mainSha: string, included: ReturnType<typeof pr>[]): EnvManifest {
  return {
    environment: 'homol',
    mainSha,
    generatedAt: '2026-11-26T00:00:00Z',
    included,
    skipped: [],
    waiting: [],
  }
}

describe('evaluateApproval', () => {
  it('exige aprovação no primeiro deploy', () => {
    const decision = evaluateApproval(manifest('m1', [pr(1, 'a')]), null, [])
    expect(decision).toMatchObject({ changed: true, approvalRequired: true })
  })

  it('não faz nada quando nada mudou', () => {
    const current = manifest('m1', [pr(1, 'a')])
    expect(evaluateApproval(current, current, [])).toEqual({
      changed: false,
      approvalRequired: false,
      reasons: [],
    })
  })

  it('exige aprovação para PR nova ou com commit novo', () => {
    const previous = manifest('m1', [pr(1, 'a')])
    expect(evaluateApproval(manifest('m1', [pr(1, 'b')]), previous, []).approvalRequired).toBe(true)
    expect(
      evaluateApproval(manifest('m1', [pr(1, 'a'), pr(2, 'c')]), previous, []).approvalRequired,
    ).toBe(true)
  })

  it('sobe sem aprovação quando só saiu PR (merge ou label removido)', () => {
    const previous = manifest('m1', [pr(1, 'a'), pr(2, 'b')])
    const decision = evaluateApproval(manifest('m2', [pr(2, 'b')]), previous, [
      { sha: 'm2', pullRequest: { number: 1, headSha: 'a' } },
    ])
    expect(decision).toMatchObject({ changed: true, approvalRequired: false })
  })

  it('publica sem aprovação quando só muda a lista de PRs puladas', () => {
    const previous = manifest('m1', [pr(1, 'a')])
    const next = {
      ...manifest('m1', [pr(1, 'a')]),
      skipped: [
        { ...pr(2, 'b'), reason: 'build' as const, detail: 'build falha com esta PR somada a #1' },
      ],
    }
    expect(evaluateApproval(next, previous, [])).toEqual({
      changed: true,
      approvalRequired: false,
      reasons: [],
    })
  })

  it('exige aprovação quando a main recebeu commit que não passou pelo ambiente', () => {
    const previous = manifest('m1', [pr(1, 'a')])
    const withoutPullRequest = evaluateApproval(manifest('m2', [pr(1, 'a')]), previous, [
      { sha: 'm2', pullRequest: null },
    ])
    const otherVersion = evaluateApproval(manifest('m2', []), previous, [
      { sha: 'm2', pullRequest: { number: 1, headSha: 'z' } },
    ])
    expect(withoutPullRequest.approvalRequired).toBe(true)
    expect(otherVersion.approvalRequired).toBe(true)
  })

  it('exige aprovação quando a main não descende da anterior', () => {
    const previous = manifest('m1', [])
    expect(evaluateApproval(manifest('m9', []), previous, null).approvalRequired).toBe(true)
  })
})
