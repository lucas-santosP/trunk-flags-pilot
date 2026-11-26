import { describe, expect, it } from 'vitest'

import { planEnvironment } from './env-plan.ts'
import type { PullRequestSnapshot } from './env-plan.ts'

function pullRequest(
  overrides: Partial<PullRequestSnapshot> & { number: number },
): PullRequestSnapshot {
  return {
    title: `PR ${overrides.number}`,
    url: `https://exemplo.invalid/pull/${overrides.number}`,
    headSha: `sha${overrides.number}`,
    isDraft: false,
    isCrossRepository: false,
    labels: [],
    ciState: 'success',
    createdAt: '2026-11-01T00:00:00Z',
    approvedAt: '2026-11-02T00:00:00Z',
    changesRequested: false,
    homolLabeledAt: null,
    ...overrides,
  }
}

function numbers(items: { number: number }[]): number[] {
  return items.map(function toNumber(item) {
    return item.number
  })
}

describe('planEnvironment', () => {
  it('homol: só PRs com label, na ordem em que o label foi aplicado', () => {
    const plan = planEnvironment(
      [
        pullRequest({ number: 1, labels: ['homol'], homolLabeledAt: '2026-11-10T00:00:00Z' }),
        pullRequest({ number: 2 }),
        pullRequest({ number: 3, labels: ['homol'], homolLabeledAt: '2026-11-05T00:00:00Z' }),
      ],
      { environment: 'homol', requireApprovedReview: true },
    )
    expect(numbers(plan.candidates)).toEqual([3, 1])
  })

  it('dev: PRs de homol primeiro, depois as aprovadas pela data de aprovação', () => {
    const plan = planEnvironment(
      [
        pullRequest({ number: 1, approvedAt: '2026-11-03T00:00:00Z' }),
        pullRequest({ number: 2, approvedAt: '2026-11-01T00:00:00Z' }),
        pullRequest({ number: 3, labels: ['homol'], homolLabeledAt: '2026-11-20T00:00:00Z' }),
      ],
      { environment: 'dev', requireApprovedReview: true },
    )
    expect(numbers(plan.candidates)).toEqual([3, 2, 1])
  })

  it('ignora draft, fork, sem aprovação e com mudanças solicitadas', () => {
    const plan = planEnvironment(
      [
        pullRequest({ number: 1, isDraft: true }),
        pullRequest({ number: 2, isCrossRepository: true }),
        pullRequest({ number: 3, approvedAt: null }),
        pullRequest({ number: 4, changesRequested: true }),
        pullRequest({ number: 5 }),
      ],
      { environment: 'dev', requireApprovedReview: true },
    )
    expect(numbers(plan.candidates)).toEqual([5])
    expect(plan.skipped).toEqual([])
  })

  it('sem exigir review, ordena por criação da PR', () => {
    const plan = planEnvironment(
      [
        pullRequest({ number: 1, approvedAt: null, createdAt: '2026-11-09T00:00:00Z' }),
        pullRequest({ number: 2, approvedAt: null, createdAt: '2026-11-08T00:00:00Z' }),
      ],
      { environment: 'dev', requireApprovedReview: false },
    )
    expect(numbers(plan.candidates)).toEqual([2, 1])
  })

  it('separa CI vermelho (pulada) de CI pendente (aguardando)', () => {
    const plan = planEnvironment(
      [
        pullRequest({ number: 1, ciState: 'failure' }),
        pullRequest({ number: 2, ciState: 'pending' }),
      ],
      { environment: 'dev', requireApprovedReview: true },
    )
    expect(plan.candidates).toEqual([])
    expect(plan.skipped).toMatchObject([{ number: 1, reason: 'ci-failed' }])
    expect(numbers(plan.waiting)).toEqual([2])
  })
})
