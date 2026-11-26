import { describe, expect, it } from 'vitest'

import { homolPendingComment, parseNumbers, pullRequestsSince } from './notify.ts'

function entry(sha: string, number: number | null) {
  return { sha, number, title: `commit ${sha}` }
}

describe('pullRequestsSince', () => {
  it('lista as PRs até o commit da última release publicada', () => {
    const history = [entry('c3', 12), entry('c2', null), entry('c1', 11), entry('c0', 10)]
    expect(pullRequestsSince(history, 'c0')).toEqual([12, 11])
  })

  it('usa todo o histórico quando não há release publicada', () => {
    expect(pullRequestsSince([entry('c1', 11), entry('c0', 10)], null)).toEqual([11, 10])
  })
})

describe('parseNumbers', () => {
  it('converte a lista separada por vírgula e ignora vazios', () => {
    expect(parseNumbers('8, 10,,x')).toEqual([8, 10])
    expect(parseNumbers('')).toEqual([])
  })
})

describe('homolPendingComment', () => {
  it('inclui o link do run e as PRs do deploy', () => {
    const comment = homolPendingComment('homol-abc1234-r1', 'https://run', [
      { number: 8, title: 'A', url: 'u', headSha: 's' },
      { number: 10, title: 'B', url: 'u', headSha: 's' },
    ])
    expect(comment).toContain('[Revisar e aprovar](https://run)')
    expect(comment).toContain('#8, #10')
  })
})
