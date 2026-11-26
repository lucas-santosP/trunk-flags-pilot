import { execFileSync } from 'node:child_process'

import type { CiState, PullRequestSnapshot } from './env-plan.ts'
import { HOMOL_LABEL } from './env-plan.ts'
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

type CommitPullRequest = { number: number; merged_at: string | null; head: { sha: string } }

export function mainCommitFor(repository: string, sha: string): MainCommit {
  const pulls = ghJson<CommitPullRequest[]>(['api', `repos/${repository}/commits/${sha}/pulls`])
  const merged = pulls.find(function isMerged(pull) {
    return pull.merged_at !== null
  })
  return {
    sha,
    pullRequest: merged ? { number: merged.number, headSha: merged.head.sha } : null,
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

export function upsertMarkedComment(
  repository: string,
  number: number,
  marker: string,
  body: string,
  createIfMissing: boolean,
): void {
  const fullBody = `${marker}\n${body}`
  const existing = findMarkedComment(repository, number, marker)
  if (existing) {
    if (existing.body !== fullBody) {
      gh(
        [
          'api',
          '--method',
          'PATCH',
          `repos/${repository}/issues/comments/${existing.id}`,
          '--input',
          '-',
        ],
        JSON.stringify({ body: fullBody }),
      )
    }
    return
  }
  if (createIfMissing) {
    gh(
      ['api', '--method', 'POST', `repos/${repository}/issues/${number}/comments`, '--input', '-'],
      JSON.stringify({ body: fullBody }),
    )
  }
}
