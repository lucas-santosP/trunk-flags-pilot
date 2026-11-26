import { readFileSync, writeFileSync } from 'node:fs'

import type { EnvManifest } from '../shared/env-manifest.ts'
import { assemble, fetchPullRequestHeads } from './lib/assembly.ts'
import { git, tryGit } from './lib/git.ts'
import type { CommitState } from './lib/github.ts'
import {
  commitStatusState,
  currentRepository,
  currentRunUrl,
  fetchOpenPullRequests,
  setCommitStatus,
} from './lib/github.ts'
import { markStageOutside, writeStage } from './lib/card-writer.ts'
import { pullRequestsOutsideEnvironment, STATUS_CONTEXTS } from './lib/env-status.ts'

function pushEnvironmentBranch(manifest: EnvManifest): void {
  fetchPullRequestHeads(manifest.included)
  const result = assemble(manifest.environment, manifest.mainSha, manifest.included)
  if (result.conflicts.length > 0) {
    console.log('::warning::Remontagem divergiu da montagem do build. Branch env não atualizada.')
    return
  }
  writeFileSync('env-manifest.json', `${JSON.stringify(manifest, null, 2)}\n`)
  git(['add', 'env-manifest.json'])
  git(['commit', '--no-verify', '-m', `env(${manifest.environment}): manifest`])
  const branch = `env/${manifest.environment}`
  if (!tryGit(['push', '--force', 'origin', `HEAD:refs/heads/${branch}`])) {
    console.log(
      `::warning::Não foi possível atualizar ${branch} (ex.: PR que altera workflows exige permissão que o GITHUB_TOKEN não tem). O deploy não é afetado.`,
    )
    return
  }
  console.log(`${branch} atualizada`)
}

function report(manifest: EnvManifest, version: string): void {
  const repository = currentRepository()
  const context = STATUS_CONTEXTS[manifest.environment]
  const targetUrl = currentRunUrl()

  for (const pullRequest of manifest.included) {
    setCommitStatus(
      repository,
      pullRequest.headSha,
      context,
      'success',
      `Incluída no deploy de ${manifest.environment} (${version})`,
      targetUrl,
    )
    writeStage(
      repository,
      pullRequest.number,
      manifest.environment,
      { kind: 'live', text: `no ar em \`${version}\` · [run](${targetUrl})` },
      true,
    )
  }

  for (const pullRequest of manifest.skipped) {
    const state: CommitState = 'failure'
    setCommitStatus(
      repository,
      pullRequest.headSha,
      context,
      state,
      `Fora de ${manifest.environment}: ${pullRequest.detail}`,
      targetUrl,
    )
    writeStage(
      repository,
      pullRequest.number,
      manifest.environment,
      {
        kind: 'skipped',
        text: `pulada no deploy \`${version}\`: ${pullRequest.detail}. Resolva e faça push · [run](${targetUrl})`,
      },
      true,
    )
  }

  const openPullRequests = fetchOpenPullRequests(repository).filter(
    function isSameRepository(pullRequest) {
      return !pullRequest.isCrossRepository
    },
  )
  const waitingNumbers = new Set(
    manifest.waiting.map(function toNumber(pullRequest) {
      return pullRequest.number
    }),
  )
  for (const pullRequest of pullRequestsOutsideEnvironment(openPullRequests, manifest)) {
    const waiting = waitingNumbers.has(pullRequest.number)
    markStageOutside(repository, pullRequest.number, manifest.environment, {
      kind: 'out',
      text: waiting
        ? `commit novo aguardando CI (deploy \`${version}\`)`
        : `fora desde o deploy \`${version}\``,
    })
    const state = commitStatusState(repository, pullRequest.headSha, context)
    if (state === null || state === 'pending') {
      continue
    }
    setCommitStatus(
      repository,
      pullRequest.headSha,
      context,
      'pending',
      `Fora de ${manifest.environment} no deploy ${version}`,
      targetUrl,
    )
  }
}

function main(): void {
  const manifest = JSON.parse(
    readFileSync(process.argv[2] ?? 'manifest.json', 'utf8'),
  ) as EnvManifest
  const version = process.argv[3] ?? manifest.mainSha.slice(0, 7)
  pushEnvironmentBranch(manifest)
  report(manifest, version)
}

main()
