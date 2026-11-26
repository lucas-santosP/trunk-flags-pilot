import { spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

import type { EnvManifest, SkippedPullRequest } from '../shared/env-manifest.ts'
import { assemble, fetchPullRequestHeads } from './lib/assembly.ts'
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

function main(): void {
  const planPath = resolve(process.argv[2] ?? 'plan.json')
  const manifestPath = resolve(process.argv[3] ?? 'manifest.json')
  const plan = JSON.parse(readFileSync(planPath, 'utf8')) as Plan
  const mainSha = git(['rev-parse', 'HEAD'])

  fetchPullRequestHeads(plan.candidates)

  const removedForBuild: SkippedPullRequest[] = []

  for (;;) {
    const removedNumbers = new Set(
      removedForBuild.map(function toNumber(pullRequest) {
        return pullRequest.number
      }),
    )
    const candidates = plan.candidates.filter(function isKept(pullRequest) {
      return !removedNumbers.has(pullRequest.number)
    })
    const result = assemble(plan.environment, mainSha, candidates)
    const manifest: EnvManifest = {
      environment: plan.environment,
      mainSha,
      generatedAt: new Date().toISOString(),
      included: result.included,
      skipped: [...plan.skipped, ...result.conflicts, ...removedForBuild],
      waiting: plan.waiting,
    }
    writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)

    console.log(
      `::group::Build ${plan.environment} com ${result.included.length} PR(s): ${result.included
        .map(function toName(pullRequest) {
          return `#${pullRequest.number}`
        })
        .join(' ')}`,
    )
    const succeeded = build(plan.environment, mainSha, manifestPath)
    console.log('::endgroup::')

    if (succeeded) {
      console.log(`Build ${plan.environment} OK`)
      return
    }

    const culprit = result.included.at(-1)
    if (!culprit) {
      console.error(
        '::error::A main sozinha não builda. Corrija a main antes de montar os ambientes.',
      )
      process.exit(1)
    }
    const others = result.included.slice(0, -1).map(function toName(pullRequest) {
      return `#${pullRequest.number}`
    })
    removedForBuild.push({
      ...culprit,
      reason: 'build',
      detail:
        others.length > 0
          ? `build falha com esta PR somada a ${others.join(', ')}`
          : 'build falha com esta PR sobre a main',
    })
    console.log(`::warning::#${culprit.number} removida da montagem: o build falhou com ela`)
  }
}

main()
