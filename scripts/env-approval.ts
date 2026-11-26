import { appendFileSync, readFileSync } from 'node:fs'

import type { EnvManifest, ManifestPullRequest } from '../shared/env-manifest.ts'
import { evaluateApproval } from './lib/env-approval.ts'
import type { MainCommit } from './lib/env-approval.ts'
import { firstParentCommits, isAncestor, tryGit } from './lib/git.ts'
import { currentRepository, mainCommitFor } from './lib/github.ts'

async function fetchPreviousManifest(url: string | undefined): Promise<EnvManifest | null> {
  if (!url) {
    return null
  }
  try {
    const response = await fetch(url, { cache: 'no-store' })
    if (!response.ok) {
      return null
    }
    return (await response.json()) as EnvManifest
  } catch {
    return null
  }
}

function collectMainCommits(previous: EnvManifest, next: EnvManifest): MainCommit[] | null {
  if (previous.mainSha === next.mainSha) {
    return []
  }
  if (!tryGit(['cat-file', '-e', `${previous.mainSha}^{commit}`])) {
    return null
  }
  if (!isAncestor(previous.mainSha, next.mainSha)) {
    return null
  }
  const repository = currentRepository()
  return firstParentCommits(previous.mainSha, next.mainSha).map(function toMainCommit(sha) {
    return mainCommitFor(repository, sha)
  })
}

function listRows(
  pullRequests: ManifestPullRequest[],
  suffix: (item: ManifestPullRequest) => string,
): string {
  if (pullRequests.length === 0) {
    return '_nenhuma_\n'
  }
  return pullRequests
    .map(function toRow(pullRequest) {
      return `- [#${pullRequest.number}](${pullRequest.url}) ${pullRequest.title} \`${pullRequest.headSha.slice(0, 7)}\`${suffix(pullRequest)}`
    })
    .join('\n')
    .concat('\n')
}

function writeOutputs(values: Record<string, string>): void {
  const outputPath = process.env.GITHUB_OUTPUT
  const lines = Object.entries(values)
    .map(function toLine([key, value]) {
      return `${key}=${value}`
    })
    .join('\n')
  if (outputPath) {
    appendFileSync(outputPath, `${lines}\n`)
  } else {
    console.log(lines)
  }
}

async function main(): Promise<void> {
  const next = JSON.parse(readFileSync(process.argv[2] ?? 'manifest.json', 'utf8')) as EnvManifest
  const previous = await fetchPreviousManifest(process.argv[3])
  const mainCommits = previous ? collectMainCommits(previous, next) : []
  const decision = evaluateApproval(next, previous, mainCommits)
  const approvalRequired = next.environment === 'homol' && decision.approvalRequired

  const summary = [
    `## Montagem de ${next.environment}`,
    '',
    `main: \`${next.mainSha.slice(0, 7)}\``,
    '',
    '### Incluídas (nesta ordem)',
    listRows(next.included, function noSuffix() {
      return ''
    }),
    '### Puladas',
    listRows(next.skipped, function withReason(pullRequest) {
      const skipped = next.skipped.find(function matches(item) {
        return item.number === pullRequest.number
      })
      return skipped ? `: ${skipped.detail}` : ''
    }),
    '### Aguardando CI',
    listRows(next.waiting, function noSuffix() {
      return ''
    }),
    '### Decisão',
    !decision.changed
      ? 'Sem mudanças em relação ao que está no ar. Deploy não necessário.'
      : approvalRequired
        ? `**Aprovação necessária**:\n${decision.reasons
            .map(function toItem(reason) {
              return `- ${reason}`
            })
            .join('\n')}`
        : 'Deploy automático: nenhum código novo em relação ao último deploy aprovado.',
    '',
  ].join('\n')

  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary)
  }
  console.log(summary)

  writeOutputs({
    changed: String(decision.changed),
    approval_required: String(approvalRequired),
  })
}

await main()
