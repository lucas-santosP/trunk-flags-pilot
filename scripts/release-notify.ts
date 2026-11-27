import { appendFileSync } from 'node:fs'

import { git, readMainHistory, tryGit } from './lib/git.ts'
import { markProductionRolledBack, writeStage } from './lib/card-writer.ts'
import { currentRepository, currentRunUrl, latestPublishedReleaseTag } from './lib/github.ts'
import { parseNumbers, pullRequestsSince } from './lib/notify.ts'

const HISTORY_LIMIT = 100

function publishedSha(repository: string): string | null {
  const tag = latestPublishedReleaseTag(repository)
  if (!tag || !tryGit(['rev-parse', '--verify', '--quiet', `refs/tags/${tag}`])) {
    return null
  }
  return git(['rev-list', '-n', '1', tag])
}

function notifyPending(repository: string, version: string): void {
  const history = readMainHistory(process.env.GITHUB_SHA ?? 'HEAD', HISTORY_LIMIT)
  const stopSha = publishedSha(repository)
  const numbers = stopSha
    ? pullRequestsSince(history, stopSha)
    : pullRequestsSince(history.slice(0, 1), null)
  for (const number of numbers) {
    writeStage(
      repository,
      number,
      'production',
      {
        kind: 'approval',
        text: `release \`${version}\` aguardando aprovação · [Revisar e aprovar](${currentRunUrl()})`,
      },
      true,
    )
    console.log(`#${number}: aguardando aprovação de produção`)
  }
  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, `pull_requests=${numbers.join(',')}\n`)
  }
}

function notifyDone(repository: string, version: string, numbers: number[]): void {
  for (const number of numbers) {
    writeStage(
      repository,
      number,
      'production',
      { kind: 'live', text: `em produção na release \`${version}\` · [run](${currentRunUrl()})` },
      true,
    )
    console.log(`#${number}: em produção`)
  }
}

function notifyRollback(repository: string, tag: string): void {
  const history = readMainHistory('origin/main', HISTORY_LIMIT)
  const tagSha = git(['rev-list', '-n', '1', tag])
  for (const number of pullRequestsSince(history, tagSha)) {
    markProductionRolledBack(repository, number, {
      kind: 'skipped',
      text: `revertida pelo rollback para \`${tag}\` · [run](${currentRunUrl()}). Volta na próxima release`,
    })
    console.log(`#${number}: marcada como revertida (se estava em produção)`)
  }
}

function main(): void {
  const [mode, version, numbers] = process.argv.slice(2)
  const modes = ['pending', 'done', 'rollback']
  if (!version || !modes.includes(mode)) {
    console.error('uso: release-notify.ts <pending|done|rollback> <versão> [prs]')
    process.exit(1)
  }
  const repository = currentRepository()
  if (mode === 'pending') {
    notifyPending(repository, version)
  } else if (mode === 'done') {
    notifyDone(repository, version, parseNumbers(numbers))
  } else {
    notifyRollback(repository, version)
  }
}

main()
