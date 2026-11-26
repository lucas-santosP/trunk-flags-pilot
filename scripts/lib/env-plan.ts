import type {
  AssembledEnvironment,
  ManifestPullRequest,
  SkippedPullRequest,
} from '../../shared/env-manifest.ts'

export const HOMOL_LABEL = 'homol'

export type CiState = 'success' | 'failure' | 'pending'

export type PullRequestSnapshot = ManifestPullRequest & {
  isDraft: boolean
  isCrossRepository: boolean
  labels: string[]
  ciState: CiState
  createdAt: string
  approvedAt: string | null
  changesRequested: boolean
  homolLabeledAt: string | null
}

export type PlanOptions = {
  environment: AssembledEnvironment
  requireApprovedReview: boolean
}

export type Plan = {
  environment: AssembledEnvironment
  candidates: ManifestPullRequest[]
  skipped: SkippedPullRequest[]
  waiting: ManifestPullRequest[]
}

type Ranked = {
  pullRequest: PullRequestSnapshot
  group: number
  enteredAt: string
}

function toManifestPullRequest(pullRequest: PullRequestSnapshot): ManifestPullRequest {
  return {
    number: pullRequest.number,
    title: pullRequest.title,
    url: pullRequest.url,
    headSha: pullRequest.headSha,
  }
}

function isReviewed(pullRequest: PullRequestSnapshot, requireApprovedReview: boolean): boolean {
  if (!requireApprovedReview) {
    return true
  }
  return pullRequest.approvedAt !== null && !pullRequest.changesRequested
}

function isInHomol(pullRequest: PullRequestSnapshot): boolean {
  return pullRequest.labels.includes(HOMOL_LABEL) && pullRequest.homolLabeledAt !== null
}

function rank(pullRequest: PullRequestSnapshot, options: PlanOptions): Ranked | null {
  if (pullRequest.isDraft || pullRequest.isCrossRepository) {
    return null
  }
  if (!isReviewed(pullRequest, options.requireApprovedReview)) {
    return null
  }
  if (isInHomol(pullRequest)) {
    return { pullRequest, group: 0, enteredAt: pullRequest.homolLabeledAt ?? '' }
  }
  if (options.environment === 'homol') {
    return null
  }
  const enteredAt = options.requireApprovedReview
    ? (pullRequest.approvedAt ?? pullRequest.createdAt)
    : pullRequest.createdAt
  return { pullRequest, group: 1, enteredAt }
}

function compareRanked(first: Ranked, second: Ranked): number {
  if (first.group !== second.group) {
    return first.group - second.group
  }
  if (first.enteredAt !== second.enteredAt) {
    return first.enteredAt < second.enteredAt ? -1 : 1
  }
  return first.pullRequest.number - second.pullRequest.number
}

export function planEnvironment(pullRequests: PullRequestSnapshot[], options: PlanOptions): Plan {
  const ranked = pullRequests
    .map(function toRanked(pullRequest) {
      return rank(pullRequest, options)
    })
    .filter(function isRanked(item): item is Ranked {
      return item !== null
    })
    .sort(compareRanked)

  const plan: Plan = { environment: options.environment, candidates: [], skipped: [], waiting: [] }

  for (const { pullRequest } of ranked) {
    const entry = toManifestPullRequest(pullRequest)
    if (pullRequest.ciState === 'success') {
      plan.candidates.push(entry)
    } else if (pullRequest.ciState === 'failure') {
      plan.skipped.push({ ...entry, reason: 'ci-failed', detail: 'CI da PR está vermelho' })
    } else {
      plan.waiting.push(entry)
    }
  }

  return plan
}
