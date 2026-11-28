import type { EnvManifest } from '../../shared/env-manifest.ts'

export type MainCommit = {
  sha: string
  pullRequest: { number: number; headSha: string; hotfix?: boolean } | null
}

export type ApprovalDecision = {
  changed: boolean
  approvalRequired: boolean
  reasons: string[]
}

function includedKey(manifest: EnvManifest): string {
  return manifest.included
    .map(function toKey(pullRequest) {
      return `${pullRequest.number}@${pullRequest.headSha}`
    })
    .join(',')
}

function skippedKey(manifest: EnvManifest): string {
  return manifest.skipped
    .map(function toKey(pullRequest) {
      return `${pullRequest.number}@${pullRequest.headSha}:${pullRequest.reason}`
    })
    .join(',')
}

export function hasChanges(next: EnvManifest, previous: EnvManifest | null): boolean {
  if (!previous) {
    return true
  }
  return (
    next.mainSha !== previous.mainSha ||
    includedKey(next) !== includedKey(previous) ||
    skippedKey(next) !== skippedKey(previous)
  )
}

function wasDeployedWith(previous: EnvManifest, number: number, headSha: string): boolean {
  return previous.included.some(function matches(pullRequest) {
    return pullRequest.number === number && pullRequest.headSha === headSha
  })
}

export function newPullRequests(
  next: EnvManifest,
  previous: EnvManifest | null,
): EnvManifest['included'] {
  return next.included.filter(function isNew(pullRequest) {
    return !previous || !wasDeployedWith(previous, pullRequest.number, pullRequest.headSha)
  })
}

export function evaluateApproval(
  next: EnvManifest,
  previous: EnvManifest | null,
  mainCommits: MainCommit[] | null,
): ApprovalDecision {
  const changed = hasChanges(next, previous)
  if (!changed) {
    return { changed, approvalRequired: false, reasons: [] }
  }
  if (!previous) {
    return { changed, approvalRequired: true, reasons: ['primeiro deploy montado deste ambiente'] }
  }

  const reasons: string[] = []

  for (const pullRequest of newPullRequests(next, previous)) {
    reasons.push(
      `PR #${pullRequest.number} nova ou com commits novos (${pullRequest.headSha.slice(0, 7)})`,
    )
  }

  if (mainCommits === null) {
    reasons.push(
      `main atual não descende da main do último deploy (${previous.mainSha.slice(0, 7)})`,
    )
  } else {
    for (const commit of mainCommits) {
      if (!commit.pullRequest) {
        reasons.push(`commit ${commit.sha.slice(0, 7)} entrou na main sem PR`)
      } else if (commit.pullRequest.hotfix) {
        continue
      } else if (
        !wasDeployedWith(previous, commit.pullRequest.number, commit.pullRequest.headSha)
      ) {
        reasons.push(
          `commit ${commit.sha.slice(0, 7)} (PR #${commit.pullRequest.number}) entrou na main sem ter passado por este ambiente`,
        )
      }
    }
  }

  return { changed, approvalRequired: reasons.length > 0, reasons }
}
