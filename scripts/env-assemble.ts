import { spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

import type {
  EnvManifest,
  ManifestPullRequest,
  SkippedPullRequest,
} from '../shared/env-manifest.ts'
import { assemble, fetchPullRequestHeads } from './lib/assembly.ts'
import type { Attempt, Selection } from './lib/build-selection.ts'
import { MainDoesNotBuildError, selectBuildable } from './lib/build-selection.ts'
import type { Plan } from './lib/env-plan.ts'
import { git } from './lib/git.ts'

function run(command: string, args: string[], env: NodeJS.ProcessEnv): boolean {
  const result = spawnSync(command, args, { stdio: 'inherit', env, shell: false })
  return result.status === 0
}

function build(environment: string, mainSha: string, manifestPath: string): boolean {
  const env = {
    ...process.env,
    COMMIT_SHA: mainSha,
    MAIN_SHA: mainSha,
    ENV_MANIFEST_FILE: manifestPath,
  }
  return (
    run('bun', ['install', '--frozen-lockfile'], env) &&
    run('bun', ['run', `build:${environment}`], env)
  )
}

function buildLabel(environment: string, pullRequests: ManifestPullRequest[]): string {
  const names = pullRequests.map(function toName(pullRequest) {
    return `#${pullRequest.number}`
  })
  return `::group::Build ${environment} com ${pullRequests.length} PR(s): ${names.join(' ')}`
}

function main(): void {
  const planPath = resolve(process.argv[2] ?? 'plan.json')
  const manifestPath = resolve(process.argv[3] ?? 'manifest.json')
  const plan = JSON.parse(readFileSync(planPath, 'utf8')) as Plan
  const mainSha = git(['rev-parse', 'HEAD'])

  fetchPullRequestHeads(plan.candidates)

  const fullAssembly = assemble(plan.environment, mainSha, plan.candidates)
  const baseSkipped = [...plan.skipped, ...fullAssembly.conflicts]

  function writeManifest(included: ManifestPullRequest[], skipped: SkippedPullRequest[]): void {
    const manifest: EnvManifest = {
      environment: plan.environment,
      mainSha,
      generatedAt: new Date().toISOString(),
      included,
      skipped,
      waiting: plan.waiting,
    }
    writeFileSync(
      manifestPath,
      `${JSON.stringify(manifest, null, 2)}
`,
    )
  }

  function attempt(pullRequests: ManifestPullRequest[]): Attempt {
    const result = assemble(plan.environment, mainSha, pullRequests)
    if (result.conflicts.length > 0) {
      return { ok: false, reason: 'conflict', detail: result.conflicts[0].detail }
    }
    writeManifest(result.included, baseSkipped)
    console.log(buildLabel(plan.environment, result.included))
    const succeeded = build(plan.environment, mainSha, manifestPath)
    console.log('::endgroup::')
    return succeeded ? { ok: true } : { ok: false, reason: 'build' }
  }

  let selection: Selection<ManifestPullRequest>
  try {
    selection = selectBuildable(fullAssembly.included, attempt)
  } catch (error) {
    if (error instanceof MainDoesNotBuildError) {
      console.error(`::error::${error.message}`)
      process.exit(1)
    }
    throw error
  }

  const removed: SkippedPullRequest[] = selection.removed.map(function toSkipped(removal) {
    console.log(`::warning::#${removal.pullRequest.number} removida da montagem: ${removal.detail}`)
    return { ...removal.pullRequest, reason: removal.reason, detail: removal.detail }
  })

  const finalAssembly = assemble(plan.environment, mainSha, selection.accepted)
  writeManifest(finalAssembly.included, [...baseSkipped, ...removed])
  if (removed.length === 0) {
    console.log(`Build ${plan.environment} OK`)
    return
  }
  console.log(buildLabel(plan.environment, finalAssembly.included))
  const succeeded = build(plan.environment, mainSha, manifestPath)
  console.log('::endgroup::')
  if (!succeeded) {
    console.error('::error::O build final falhou após remover as PRs que quebravam.')
    process.exit(1)
  }
  console.log(`Build ${plan.environment} OK`)
}

main()
