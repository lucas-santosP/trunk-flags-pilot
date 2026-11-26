import type { ManifestPullRequest, SkippedPullRequest } from '../../shared/env-manifest.ts'
import { git, tryGit } from './git.ts'

export type AssemblyResult = {
  included: ManifestPullRequest[]
  conflicts: SkippedPullRequest[]
}

export function fetchPullRequestHeads(pullRequests: ManifestPullRequest[]): void {
  for (const pullRequest of pullRequests) {
    if (!tryGit(['cat-file', '-e', `${pullRequest.headSha}^{commit}`])) {
      git(['fetch', '--no-tags', 'origin', pullRequest.headSha])
    }
  }
}

function changedFiles(base: string, head: string): string[] {
  const output = git(['diff', '--name-only', `${base}...${head}`])
  return output ? output.split('\n') : []
}

function describeConflict(
  mainSha: string,
  included: ManifestPullRequest[],
  conflictedFiles: string[],
): string {
  const culprits = included.filter(function touchesConflict(other) {
    const files = changedFiles(mainSha, other.headSha)
    return conflictedFiles.some(function isShared(file) {
      return files.includes(file)
    })
  })
  const files = conflictedFiles.join(', ')
  if (culprits.length === 0) {
    return `conflita com a main em ${files}: atualize a branch com a main`
  }
  const names = culprits
    .map(function toName(other) {
      return `#${other.number}`
    })
    .join(', ')
  return `conflita com ${names} em ${files}`
}

export function mergeMessage(environment: string, pullRequest: ManifestPullRequest): string {
  return `env(${environment}): #${pullRequest.number} ${pullRequest.title}`
}

export function assemble(
  environment: string,
  mainSha: string,
  candidates: ManifestPullRequest[],
): AssemblyResult {
  git(['checkout', '--force', '--detach', mainSha])
  const result: AssemblyResult = { included: [], conflicts: [] }

  for (const pullRequest of candidates) {
    const merged = tryGit([
      'merge',
      '--no-ff',
      '--no-edit',
      '-m',
      mergeMessage(environment, pullRequest),
      pullRequest.headSha,
    ])
    if (merged) {
      result.included.push(pullRequest)
      continue
    }
    const conflictedOutput = git(['diff', '--name-only', '--diff-filter=U'])
    const conflictedFiles = conflictedOutput ? conflictedOutput.split('\n') : []
    git(['merge', '--abort'])
    result.conflicts.push({
      ...pullRequest,
      reason: 'conflict',
      detail: describeConflict(mainSha, result.included, conflictedFiles),
    })
  }

  return result
}
