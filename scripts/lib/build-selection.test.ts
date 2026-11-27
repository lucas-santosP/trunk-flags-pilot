import { describe, expect, it } from 'vitest'

import type { Attempt } from './build-selection.ts'
import { MainDoesNotBuildError, selectBuildable } from './build-selection.ts'

function pr(number: number) {
  return { number }
}

function failsWith(...broken: number[][]) {
  const attempts: number[][] = []
  function attempt(pullRequests: { number: number }[]): Attempt {
    const numbers = pullRequests.map(function toNumber(pullRequest) {
      return pullRequest.number
    })
    attempts.push(numbers)
    const breaks = broken.some(function isSubset(combination) {
      return combination.every(function isIncluded(number) {
        return numbers.includes(number)
      })
    })
    return breaks ? { ok: false, reason: 'build' } : { ok: true }
  }
  return { attempt, attempts }
}

describe('selectBuildable', () => {
  it('aceita tudo com um único build quando a combinação builda', () => {
    const { attempt, attempts } = failsWith()
    expect(selectBuildable([pr(1), pr(2)], attempt)).toEqual({
      accepted: [pr(1), pr(2)],
      removed: [],
    })
    expect(attempts).toEqual([[1, 2]])
  })

  it('remove só a PR que quebra, mantendo as que entraram depois dela', () => {
    const { attempt } = failsWith([19, 20])
    const selection = selectBuildable([pr(19), pr(20), pr(21)], attempt)
    expect(selection.accepted).toEqual([pr(19), pr(21)])
    expect(selection.removed).toEqual([
      { pullRequest: pr(20), reason: 'build', detail: 'build falha com esta PR somada a #19' },
    ])
  })

  it('descreve a PR que quebra sozinha sobre a main', () => {
    const { attempt } = failsWith([7])
    const selection = selectBuildable([pr(7), pr(8)], attempt)
    expect(selection.removed[0].detail).toBe('build falha com esta PR sobre a main')
    expect(selection.accepted).toEqual([pr(8)])
  })

  it('falha quando a main sozinha não builda', () => {
    const { attempt } = failsWith([])
    expect(function select() {
      return selectBuildable([pr(1)], attempt)
    }).toThrow(MainDoesNotBuildError)
  })

  it('usa o motivo devolvido pela tentativa (ex.: conflito ao montar sem uma PR)', () => {
    function attempt(pullRequests: { number: number }[]): Attempt {
      const numbers = pullRequests.map(function toNumber(pullRequest) {
        return pullRequest.number
      })
      if (numbers.length === 3) {
        return { ok: false, reason: 'build' }
      }
      if (numbers.includes(2)) {
        return { ok: false, reason: 'build' }
      }
      if (numbers.includes(3)) {
        return { ok: false, reason: 'conflict', detail: 'conflita com a main' }
      }
      return { ok: true }
    }
    const selection = selectBuildable([pr(1), pr(2), pr(3)], attempt)
    expect(selection.accepted).toEqual([pr(1)])
    expect(
      selection.removed.map(function toReason(removal) {
        return `${removal.pullRequest.number}:${removal.reason}`
      }),
    ).toEqual(['2:build', '3:conflict'])
  })
})
