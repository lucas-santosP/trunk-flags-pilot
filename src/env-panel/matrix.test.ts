import { describe, expect, it } from 'vitest'

import type { EnvManifest } from '../../shared/env-manifest'
import { buildMatrix } from './matrix'

const history = [
  { sha: 'c3', number: 12, title: 'feat: terceira' },
  { sha: 'c2', number: 11, title: 'feat: segunda' },
  { sha: 'c1', number: null, title: 'chore: inicial' },
]

function manifest(overrides: Partial<EnvManifest>): EnvManifest {
  return {
    environment: 'homol',
    mainSha: 'c3',
    generatedAt: '2026-11-26T00:00:00Z',
    included: [],
    skipped: [],
    waiting: [],
    ...overrides,
  }
}

const openPullRequest = { number: 20, title: 'feat: aberta', url: 'u/20', headSha: 'h20' }

describe('buildMatrix', () => {
  it('mostra PR aberta incluída em homol, pulada em dev e fora de prod', () => {
    const rows = buildMatrix({
      history,
      repositoryUrl: 'https://github.com/exemplo/repo',
      manifests: {
        dev: manifest({
          environment: 'dev',
          skipped: [{ ...openPullRequest, reason: 'conflict', detail: 'conflita com #21' }],
        }),
        homol: manifest({ included: [openPullRequest] }),
      },
      productionSha: 'c2',
    })

    expect(rows[0]).toMatchObject({
      number: 20,
      merged: false,
      cells: {
        dev: { state: 'skipped', detail: 'conflita com #21' },
        homol: { state: 'included' },
        production: { state: 'absent' },
      },
    })
  })

  it('marca PR mergeada como em prod só quando a versão de prod a contém', () => {
    const rows = buildMatrix({
      history,
      repositoryUrl: null,
      manifests: { dev: manifest({ mainSha: 'c3' }), homol: manifest({ mainSha: 'c3' }) },
      productionSha: 'c2',
    })

    const third = rows.find(function isTwelve(row) {
      return row.number === 12
    })
    const second = rows.find(function isEleven(row) {
      return row.number === 11
    })
    expect(third?.cells.production.state).toBe('absent')
    expect(third?.cells.homol.state).toBe('included')
    expect(second?.cells.production.state).toBe('included')
  })

  it('usa unknown quando o ambiente não respondeu', () => {
    const rows = buildMatrix({
      history,
      repositoryUrl: null,
      manifests: { dev: null, homol: null },
      productionSha: null,
    })
    expect(rows[0].cells.dev.state).toBe('unknown')
    expect(rows[0].cells.production.state).toBe('unknown')
  })

  it('não duplica PR que aparece aberta no manifesto mas já foi mergeada', () => {
    const rows = buildMatrix({
      history,
      repositoryUrl: null,
      manifests: {
        dev: manifest({ included: [{ number: 12, title: 'x', url: 'u', headSha: 'h' }] }),
        homol: null,
      },
      productionSha: null,
    })
    expect(
      rows.filter(function isTwelve(row) {
        return row.number === 12
      }),
    ).toHaveLength(1)
  })
})
