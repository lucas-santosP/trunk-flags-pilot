import type { HistoryEntry, ManifestPullRequest } from '../../shared/env-manifest.ts'

export const RELEASE_MARKER = '<!-- release:production -->'

export function pullRequestsSince(history: HistoryEntry[], stopSha: string | null): number[] {
  const numbers: number[] = []
  for (const entry of history) {
    if (entry.sha === stopSha) {
      break
    }
    if (entry.number !== null && !numbers.includes(entry.number)) {
      numbers.push(entry.number)
    }
  }
  return numbers
}

export function parseNumbers(value: string | undefined): number[] {
  return (value ?? '')
    .split(',')
    .map(function toNumber(item) {
      return Number(item.trim())
    })
    .filter(function isValid(item) {
      return Number.isInteger(item) && item > 0
    })
}

export function homolPendingComment(
  version: string,
  runUrl: string,
  included: ManifestPullRequest[],
): string {
  const list = included
    .map(function toReference(pullRequest) {
      return `#${pullRequest.number}`
    })
    .join(', ')
  return `⏳ Aguardando aprovação do deploy de **homol** \`${version}\` · [Revisar e aprovar](${runUrl})\n\nEntram neste deploy: ${list}`
}

export function releasePendingComment(version: string, runUrl: string): string {
  return `⏳ Na release \`${version}\`, aguardando aprovação do deploy de **produção** · [Revisar e aprovar](${runUrl})`
}

export function releaseDoneComment(version: string, runUrl: string): string {
  return `🚀 Em **produção** na release \`${version}\` · [run](${runUrl})`
}
