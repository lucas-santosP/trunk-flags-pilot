import { readFileSync, writeFileSync } from 'node:fs'

import type { AssembledEnvironment, EnvManifest } from '../shared/env-manifest.ts'
import { assemble, fetchPullRequestHeads } from './lib/assembly.ts'
import { git, tryGit } from './lib/git.ts'
import type { CommitState } from './lib/github.ts'
import { currentRepository, setCommitStatus, upsertMarkedComment } from './lib/github.ts'

const STATUS_CONTEXTS: Record<AssembledEnvironment, string> = {
  dev: 'env/dev',
  homol: 'homol-validado',
}

function runUrl(): string {
  const server = process.env.GITHUB_SERVER_URL ?? 'https://github.com'
  return `${server}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`
}

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
  const marker = `<!-- env-sync:${manifest.environment} -->`
  const targetUrl = runUrl()

  for (const pullRequest of manifest.included) {
    setCommitStatus(
      repository,
      pullRequest.headSha,
      context,
      'success',
      `Incluída no deploy de ${manifest.environment} (${version})`,
      targetUrl,
    )
    upsertMarkedComment(
      repository,
      pullRequest.number,
      marker,
      `✅ Incluída em **${manifest.environment}** no deploy \`${version}\` (commit \`${pullRequest.headSha.slice(0, 7)}\`).`,
      false,
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
    upsertMarkedComment(
      repository,
      pullRequest.number,
      marker,
      `⚠️ Não entrou em **${manifest.environment}** no deploy \`${version}\`: ${pullRequest.detail}.\n\nResolva e faça push: o ambiente é remontado automaticamente.`,
      true,
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
