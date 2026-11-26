import type {
  AppEnvironment,
  EnvManifest,
  HistoryEntry,
  ManifestPullRequest,
} from '../../shared/env-manifest'

export type CellState = 'included' | 'skipped' | 'waiting' | 'absent' | 'unknown'

export type MatrixCell = {
  state: CellState
  detail?: string
}

export type MatrixRow = {
  number: number
  title: string
  url: string | null
  merged: boolean
  cells: Record<AppEnvironment, MatrixCell>
}

export type MatrixInput = {
  history: HistoryEntry[]
  repositoryUrl: string | null
  manifests: Record<'dev' | 'homol', EnvManifest | null>
  productionSha: string | null
}

const MERGED_ROWS_LIMIT = 8

function containsMerged(
  history: HistoryEntry[],
  entryIndex: number,
  deployedSha: string | null,
): CellState {
  if (!deployedSha) {
    return 'unknown'
  }
  const deployedIndex = history.findIndex(function matches(entry) {
    return entry.sha === deployedSha
  })
  if (deployedIndex === -1) {
    return 'included'
  }
  return entryIndex >= deployedIndex ? 'included' : 'absent'
}

function openCell(manifest: EnvManifest | null, number: number): MatrixCell {
  if (!manifest) {
    return { state: 'unknown' }
  }
  function hasNumber(pullRequest: ManifestPullRequest) {
    return pullRequest.number === number
  }
  if (manifest.included.some(hasNumber)) {
    return { state: 'included' }
  }
  const skipped = manifest.skipped.find(hasNumber)
  if (skipped) {
    return { state: 'skipped', detail: skipped.detail }
  }
  if (manifest.waiting.some(hasNumber)) {
    return { state: 'waiting', detail: 'aguardando CI' }
  }
  return { state: 'absent' }
}

function collectOpenPullRequests(
  input: MatrixInput,
  mergedNumbers: Set<number>,
): ManifestPullRequest[] {
  const byNumber = new Map<number, ManifestPullRequest>()
  for (const manifest of [input.manifests.dev, input.manifests.homol]) {
    if (!manifest) {
      continue
    }
    for (const pullRequest of [...manifest.included, ...manifest.skipped, ...manifest.waiting]) {
      if (!mergedNumbers.has(pullRequest.number) && !byNumber.has(pullRequest.number)) {
        byNumber.set(pullRequest.number, pullRequest)
      }
    }
  }
  return [...byNumber.values()].sort(function byNumberDesc(first, second) {
    return second.number - first.number
  })
}

export function buildMatrix(input: MatrixInput): MatrixRow[] {
  const mergedEntries = input.history
    .map(function withIndex(entry, index) {
      return { entry, index }
    })
    .filter(function hasPullRequest(item) {
      return item.entry.number !== null
    })
  const mergedNumbers = new Set(
    mergedEntries.map(function toNumber(item) {
      return item.entry.number ?? 0
    }),
  )

  const openRows = collectOpenPullRequests(input, mergedNumbers).map(
    function toRow(pullRequest): MatrixRow {
      return {
        number: pullRequest.number,
        title: pullRequest.title,
        url: pullRequest.url,
        merged: false,
        cells: {
          dev: openCell(input.manifests.dev, pullRequest.number),
          homol: openCell(input.manifests.homol, pullRequest.number),
          production: { state: 'absent' },
        },
      }
    },
  )

  const mergedRows = mergedEntries.slice(0, MERGED_ROWS_LIMIT).map(function toRow({
    entry,
    index,
  }): MatrixRow {
    const number = entry.number ?? 0
    return {
      number,
      title: entry.title,
      url: input.repositoryUrl ? `${input.repositoryUrl}/pull/${number}` : null,
      merged: true,
      cells: {
        dev: { state: containsMerged(input.history, index, input.manifests.dev?.mainSha ?? null) },
        homol: {
          state: containsMerged(input.history, index, input.manifests.homol?.mainSha ?? null),
        },
        production: { state: containsMerged(input.history, index, input.productionSha) },
      },
    }
  })

  return [...openRows, ...mergedRows]
}
