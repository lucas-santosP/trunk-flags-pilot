import { execFileSync } from 'node:child_process'

import type { CiState, PullRequestSnapshot } from './env-plan.ts'
import { HOMOL_LABEL, HOTFIX_LABEL } from './env-plan.ts'
import type { MainCommit } from './env-approval.ts'

export const CI_CHECK_NAME = 'checks'

function gh(args: string[], input?: string): string {
  return execFileSync('gh', args, {
    encoding: 'utf8',
    input,
    stdio: [input === undefined ? 'ignore' : 'pipe', 'pipe', 'pipe'],
    maxBuffer: 32 * 1024 * 1024,
  }).trim()
}

function ghJson<T>(args: string[], input?: string): T {
  return JSON.parse(gh(args, input)) as T
}

export function currentRepository(): string {
  const repository = process.env.GITHUB_REPOSITORY
  if (!repository) {
    throw new Error('GITHUB_REPOSITORY não definido')
  }
  return repository
}

export function currentRunUrl(): string {
  const server = process.env.GITHUB_SERVER_URL ?? 'https://github.com'
  return `${server}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`
}

export function latestPublishedReleaseTag(repository: string): string | null {
  try {
    return (
      gh(['release', 'view', '-R', repository, '--json', 'tagName', '--jq', '.tagName']) || null
    )
  } catch {
    return null
  }
}

const OPEN_PULL_REQUESTS_QUERY = `
query($owner: String!, $name: String!) {
  repository(owner: $owner, name: $name) {
    pullRequests(states: OPEN, baseRefName: "main", first: 100) {
      nodes {
        number
        title
        url
        isDraft
        isCrossRepository
        headRefOid
        createdAt
        labels(first: 30) { nodes { name } }
        latestReviews(first: 30) { nodes { state submittedAt } }
        timelineItems(itemTypes: [LABELED_EVENT], last: 50) {
          nodes { ... on LabeledEvent { createdAt label { name } } }
        }
        commits(last: 1) {
          nodes {
            commit {
              oid
              statusCheckRollup {
                contexts(first: 50) {
                  nodes {
                    __typename
                    ... on CheckRun { name status conclusion }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
}`

type CheckRunNode = {
  __typename: string
  name?: string
  status?: string
  conclusion?: string | null
}

type PullRequestNode = {
  number: number
  title: string
  url: string
  isDraft: boolean
  isCrossRepository: boolean
  headRefOid: string
  createdAt: string
  labels: { nodes: { name: string }[] }
  latestReviews: { nodes: { state: string; submittedAt: string | null }[] }
  timelineItems: { nodes: { createdAt?: string; label?: { name: string } }[] }
  commits: {
    nodes: {
      commit: {
        oid: string
        statusCheckRollup: { contexts: { nodes: CheckRunNode[] } } | null
      }
    }[]
  }
}

function ciStateOf(node: PullRequestNode): CiState {
  const commit = node.commits.nodes[0]?.commit
  if (!commit || commit.oid !== node.headRefOid) {
    return 'pending'
  }
  const runs = (commit.statusCheckRollup?.contexts.nodes ?? []).filter(function isCiRun(run) {
    return run.__typename === 'CheckRun' && run.name === CI_CHECK_NAME
  })
  const latest = runs.at(-1)
  if (!latest || latest.status !== 'COMPLETED') {
    return 'pending'
  }
  if (latest.conclusion === 'SUCCESS') {
    return 'success'
  }
  if (latest.conclusion === 'CANCELLED' || latest.conclusion === 'SKIPPED') {
    return 'pending'
  }
  return 'failure'
}

function toSnapshot(node: PullRequestNode): PullRequestSnapshot {
  const approvals = node.latestReviews.nodes
    .filter(function isApproval(review) {
      return review.state === 'APPROVED' && review.submittedAt !== null
    })
    .map(function toDate(review) {
      return review.submittedAt ?? ''
    })
    .sort()
  const homolLabelings = node.timelineItems.nodes
    .filter(function isHomolLabel(item) {
      return item.label?.name === HOMOL_LABEL && item.createdAt !== undefined
    })
    .map(function toDate(item) {
      return item.createdAt ?? ''
    })
    .sort()

  return {
    number: node.number,
    title: node.title,
    url: node.url,
    headSha: node.headRefOid,
    isDraft: node.isDraft,
    isCrossRepository: node.isCrossRepository,
    labels: node.labels.nodes.map(function toName(label) {
      return label.name
    }),
    ciState: ciStateOf(node),
    createdAt: node.createdAt,
    approvedAt: approvals[0] ?? null,
    changesRequested: node.latestReviews.nodes.some(function isChangeRequest(review) {
      return review.state === 'CHANGES_REQUESTED'
    }),
    homolLabeledAt: homolLabelings.at(-1) ?? null,
  }
}

export function fetchOpenPullRequests(repository: string): PullRequestSnapshot[] {
  const [owner, name] = repository.split('/')
  const response = ghJson<{ data: { repository: { pullRequests: { nodes: PullRequestNode[] } } } }>(
    [
      'api',
      'graphql',
      '-f',
      `query=${OPEN_PULL_REQUESTS_QUERY}`,
      '-F',
      `owner=${owner}`,
      '-F',
      `name=${name}`,
    ],
  )
  return response.data.repository.pullRequests.nodes.map(toSnapshot)
}

type CommitPullRequest = {
  number: number
  merged_at: string | null
  head: { sha: string }
  labels: { name: string }[]
}

export function mainCommitFor(repository: string, sha: string): MainCommit {
  const pulls = ghJson<CommitPullRequest[]>(['api', `repos/${repository}/commits/${sha}/pulls`])
  const merged = pulls.find(function isMerged(pull) {
    return pull.merged_at !== null
  })
  return {
    sha,
    pullRequest: merged
      ? {
          number: merged.number,
          headSha: merged.head.sha,
          hotfix: merged.labels.some(function isHotfix(label) {
            return label.name === HOTFIX_LABEL
          }),
        }
      : null,
  }
}

export type CommitState = 'success' | 'failure' | 'pending' | 'error'

export function setCommitStatus(
  repository: string,
  sha: string,
  context: string,
  state: CommitState,
  description: string,
  targetUrl: string,
): void {
  gh([
    'api',
    '--method',
    'POST',
    `repos/${repository}/statuses/${sha}`,
    '-f',
    `state=${state}`,
    '-f',
    `context=${context}`,
    '-f',
    `description=${description.slice(0, 140)}`,
    '-f',
    `target_url=${targetUrl}`,
  ])
}

type CombinedStatus = {
  statuses: { context: string; state: CommitState; description: string | null }[]
}

export type CommitStatus = { state: CommitState; description: string }

export function commitStatusOf(
  repository: string,
  sha: string,
  context: string,
): CommitStatus | null {
  const combined = ghJson<CombinedStatus>(['api', `repos/${repository}/commits/${sha}/status`])
  const status = combined.statuses.find(function matchesContext(item) {
    return item.context === context
  })
  return status ? { state: status.state, description: status.description ?? '' } : null
}

export function commitStatusState(
  repository: string,
  sha: string,
  context: string,
): CommitState | null {
  return commitStatusOf(repository, sha, context)?.state ?? null
}

export function collaboratorRole(repository: string, login: string): string | null {
  try {
    return (
      gh(['api', `repos/${repository}/collaborators/${login}/permission`, '--jq', '.role_name']) ||
      null
    )
  } catch {
    return null
  }
}

export function removeLabel(repository: string, number: number, label: string): void {
  gh(['api', '--method', 'DELETE', `repos/${repository}/issues/${number}/labels/${label}`])
}

export function createComment(repository: string, number: number, body: string): void {
  gh(
    ['api', '--method', 'POST', `repos/${repository}/issues/${number}/comments`, '--input', '-'],
    JSON.stringify({ body }),
  )
}

type IssueComment = { id: number; body: string }

function findMarkedComment(
  repository: string,
  number: number,
  marker: string,
): IssueComment | null {
  const comments = ghJson<IssueComment[][]>([
    'api',
    '--paginate',
    '--slurp',
    `repos/${repository}/issues/${number}/comments`,
  ]).flat()
  return (
    comments.find(function hasMarker(comment) {
      return comment.body.includes(marker)
    }) ?? null
  )
}

function writeComment(
  repository: string,
  number: number,
  existing: IssueComment | null,
  body: string,
): void {
  if (existing) {
    if (existing.body !== body) {
      gh(
        [
          'api',
          '--method',
          'PATCH',
          `repos/${repository}/issues/comments/${existing.id}`,
          '--input',
          '-',
        ],
        JSON.stringify({ body }),
      )
    }
    return
  }
  gh(
    ['api', '--method', 'POST', `repos/${repository}/issues/${number}/comments`, '--input', '-'],
    JSON.stringify({ body }),
  )
}

export function upsertComputedComment(
  repository: string,
  number: number,
  marker: string,
  compute: (currentBody: string | null) => string | null,
  createIfMissing: boolean,
): void {
  const existing = findMarkedComment(repository, number, marker)
  if (!existing && !createIfMissing) {
    return
  }
  const body = compute(existing?.body ?? null)
  if (body === null) {
    return
  }
  writeComment(repository, number, existing, body)
}
