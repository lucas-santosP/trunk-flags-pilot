import type { HistoryEntry } from '../../shared/env-manifest.ts'

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
