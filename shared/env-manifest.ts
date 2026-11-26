export const ASSEMBLED_ENVIRONMENTS = ['dev', 'homol'] as const

export type AssembledEnvironment = (typeof ASSEMBLED_ENVIRONMENTS)[number]

export type AppEnvironment = AssembledEnvironment | 'production'

export type ManifestPullRequest = {
  number: number
  title: string
  url: string
  headSha: string
}

export type SkipReason = 'conflict' | 'build' | 'ci-failed'

export type SkippedPullRequest = ManifestPullRequest & {
  reason: SkipReason
  detail: string
}

export type EnvManifest = {
  environment: AssembledEnvironment
  mainSha: string
  generatedAt: string
  included: ManifestPullRequest[]
  skipped: SkippedPullRequest[]
  waiting: ManifestPullRequest[]
}

export type VersionInfo = {
  environment: AppEnvironment
  version: string
  sha: string
}

export type HistoryEntry = {
  sha: string
  number: number | null
  title: string
}

export type EnvPanelConfig = {
  urls: Record<AppEnvironment, string> | null
  repositoryUrl: string | null
  history: HistoryEntry[]
}

const SQUASH_SUBJECT = /^(.*) \(#(\d+)\)$/

const MERGE_SUBJECT = /^Merge pull request #(\d+) from \S+$/

export function parseCommitSubject(subject: string, body: string): Omit<HistoryEntry, 'sha'> {
  const squash = SQUASH_SUBJECT.exec(subject)
  if (squash) {
    return { number: Number(squash[2]), title: squash[1] }
  }
  const merge = MERGE_SUBJECT.exec(subject)
  if (merge) {
    const firstBodyLine = body.split('\n').find(function isFilled(line) {
      return line.trim().length > 0
    })
    return { number: Number(merge[1]), title: firstBodyLine?.trim() ?? subject }
  }
  return { number: null, title: subject }
}
