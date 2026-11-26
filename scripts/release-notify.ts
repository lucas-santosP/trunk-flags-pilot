import { appendFileSync } from 'node:fs'

import { git, readMainHistory, tryGit } from './lib/git.ts'
import { writeStage } from './lib/card-writer.ts'
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

function main(): void {
  const [mode, version, numbers] = process.argv.slice(2)
  if (!version || (mode !== 'pending' && mode !== 'done')) {
    console.error('uso: release-notify.ts <pending|done> <versão> [prs]')
    process.exit(1)
  }
  const repository = currentRepository()
  if (mode === 'pending') {
    notifyPending(repository, version)
  } else {
    notifyDone(repository, version, parseNumbers(numbers))
  }
}

main()
