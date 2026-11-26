import type {
  AssembledEnvironment,
  EnvManifest,
  ManifestPullRequest,
} from '../../shared/env-manifest.ts'

export const STATUS_CONTEXTS: Record<AssembledEnvironment, string> = {
  dev: 'dev-published',
  homol: 'homol-published',
}

export function pullRequestsOutsideEnvironment(
  openPullRequests: ManifestPullRequest[],
  manifest: EnvManifest,
): ManifestPullRequest[] {
  const reported = new Set(
    [...manifest.included, ...manifest.skipped].map(function toSha(pullRequest) {
      return pullRequest.headSha
    }),
  )
  return openPullRequests.filter(function isOutside(pullRequest) {
    return !reported.has(pullRequest.headSha)
  })
}
