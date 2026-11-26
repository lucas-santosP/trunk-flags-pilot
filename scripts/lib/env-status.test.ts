import { describe, expect, it } from 'vitest'

import type { EnvManifest } from '../../shared/env-manifest.ts'
import { pullRequestsOutsideEnvironment } from './env-status.ts'

function pr(number: number, headSha: string) {
  return { number, title: `PR ${number}`, url: `u/${number}`, headSha }
}

function manifest(partial: Partial<EnvManifest>): EnvManifest {
  return {
    environment: 'homol',
    mainSha: 'm1',
    generatedAt: '2026-11-26T00:00:00Z',
    included: [],
    skipped: [],
    waiting: [],
    ...partial,
  }
}

describe('pullRequestsOutsideEnvironment', () => {
  it('retorna PRs abertas que não foram incluídas nem puladas', () => {
    const current = manifest({
      included: [pr(1, 'a')],
      skipped: [{ ...pr(2, 'b'), reason: 'conflict', detail: 'conflita com #1' }],
    })
    const open = [pr(1, 'a'), pr(2, 'b'), pr(3, 'c')]
    expect(pullRequestsOutsideEnvironment(open, current)).toEqual([pr(3, 'c')])
  })

  it('considera fora a PR incluída antes de um push novo', () => {
    const current = manifest({ included: [pr(1, 'a')] })
    expect(pullRequestsOutsideEnvironment([pr(1, 'a2')], current)).toEqual([pr(1, 'a2')])
  })

  it('considera fora as PRs aguardando CI', () => {
    const current = manifest({ waiting: [pr(4, 'd')] })
    expect(pullRequestsOutsideEnvironment([pr(4, 'd')], current)).toEqual([pr(4, 'd')])
  })
})
