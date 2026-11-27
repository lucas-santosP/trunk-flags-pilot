import type { SkipReason } from '../../shared/env-manifest.ts'

export type Attempt = { ok: true } | { ok: false; reason: SkipReason; detail?: string }

export type Removal<T> = { pullRequest: T; reason: SkipReason; detail: string }

export type Selection<T> = { accepted: T[]; removed: Removal<T>[] }

export class MainDoesNotBuildError extends Error {
  constructor() {
    super('A main sozinha não builda. Corrija a main antes de montar os ambientes.')
  }
}

function buildDetail<T extends { number: number }>(accepted: T[]): string {
  if (accepted.length === 0) {
    return 'build falha com esta PR sobre a main'
  }
  const names = accepted.map(function toName(pullRequest) {
    return `#${pullRequest.number}`
  })
  return `build falha com esta PR somada a ${names.join(', ')}`
}

export function selectBuildable<T extends { number: number }>(
  candidates: T[],
  attempt: (pullRequests: T[]) => Attempt,
): Selection<T> {
  if (attempt(candidates).ok) {
    return { accepted: candidates, removed: [] }
  }
  if (!attempt([]).ok) {
    throw new MainDoesNotBuildError()
  }
  const accepted: T[] = []
  const removed: Removal<T>[] = []
  for (const pullRequest of candidates) {
    const result = attempt([...accepted, pullRequest])
    if (result.ok) {
      accepted.push(pullRequest)
      continue
    }
    removed.push({
      pullRequest,
      reason: result.reason,
      detail: result.detail ?? buildDetail(accepted),
    })
  }
  return { accepted, removed }
}
