import { useEffect, useMemo, useState } from 'react'

import type { EnvManifest, EnvPanelConfig, VersionInfo } from '../../shared/env-manifest'
import { buildMatrix } from './matrix'
import type { CellState, MatrixCell } from './matrix'

const ENVIRONMENT_COLUMNS = [
  { key: 'dev', label: 'dev' },
  { key: 'homol', label: 'homol' },
  { key: 'production', label: 'prod' },
] as const

const CELL_STYLES: Record<CellState, { label: string; className: string }> = {
  included: {
    label: '✓ no ar',
    className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200',
  },
  skipped: {
    label: '⚠ pulada',
    className: 'bg-amber-100 text-amber-900 dark:bg-amber-900/50 dark:text-amber-200',
  },
  waiting: {
    label: '… CI',
    className: 'bg-sky-100 text-sky-800 dark:bg-sky-900/50 dark:text-sky-200',
  },
  absent: {
    label: '—',
    className: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
  },
  unknown: {
    label: '?',
    className: 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500',
  },
}

type RemoteState = {
  manifests: Record<'dev' | 'homol', EnvManifest | null>
  productionSha: string | null
}

const EMPTY_REMOTE: RemoteState = { manifests: { dev: null, homol: null }, productionSha: null }

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const response = await fetch(url, { cache: 'no-store' })
    return response.ok ? ((await response.json()) as T) : null
  } catch {
    return null
  }
}

function useRemoteState(config: EnvPanelConfig): RemoteState {
  const [state, setState] = useState<RemoteState>(EMPTY_REMOTE)

  useEffect(
    function loadRemoteState() {
      const urls = config.urls
      if (!urls) {
        return
      }
      let active = true
      Promise.all([
        fetchJson<EnvManifest>(`${urls.dev}/manifest.json`),
        fetchJson<EnvManifest>(`${urls.homol}/manifest.json`),
        fetchJson<VersionInfo>(`${urls.production}/version.json`),
      ]).then(function applyRemoteState([dev, homol, production]) {
        if (active) {
          setState({ manifests: { dev, homol }, productionSha: production?.sha ?? null })
        }
      })
      return function cancel() {
        active = false
      }
    },
    [config.urls],
  )

  return state
}

function StatusBadge({ cell }: { cell: MatrixCell }) {
  const style = CELL_STYLES[cell.state]
  return (
    <span
      title={cell.detail}
      className={`inline-flex min-w-16 justify-center rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap ${style.className}`}
    >
      {style.label}
    </span>
  )
}

export function EnvPanel({ config }: { config: EnvPanelConfig }) {
  const remote = useRemoteState(config)
  const rows = useMemo(
    function computeRows() {
      return buildMatrix({
        history: config.history,
        repositoryUrl: config.repositoryUrl,
        manifests: remote.manifests,
        productionSha: remote.productionSha,
      })
    },
    [config, remote],
  )

  return (
    <section className="rounded-2xl border border-slate-200 p-6 dark:border-slate-800">
      <h2 className="text-lg font-semibold">Mudanças por ambiente</h2>
      <p className="mt-1 text-sm text-slate-500">
        PRs abertas montadas em dev e homol e PRs já mergeadas na main. Passe o mouse em ⚠ para ver
        o motivo. A coluna destacada é o ambiente atual. Este painel não existe em produção.
      </p>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-500">
              <th className="py-2 pr-4 font-medium">PR</th>
              {ENVIRONMENT_COLUMNS.map(function renderHeader(column) {
                const current = column.key === __APP_ENV__
                return (
                  <th
                    key={column.key}
                    className={`px-3 py-2 text-center font-medium ${
                      current
                        ? 'rounded-t-lg bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300'
                        : ''
                    }`}
                  >
                    {column.label}
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map(function renderRow(row) {
              return (
                <tr key={row.number} className="border-t border-slate-100 dark:border-slate-800">
                  <td className="py-2 pr-4">
                    <div className="flex items-baseline gap-2">
                      {row.url ? (
                        <a className="font-mono text-indigo-600 hover:underline" href={row.url}>
                          #{row.number}
                        </a>
                      ) : (
                        <span className="font-mono">#{row.number}</span>
                      )}
                      <span className="text-slate-700 dark:text-slate-300">{row.title}</span>
                    </div>
                    <span className="text-xs text-slate-400">
                      {row.merged ? 'mergeada' : 'aberta'}
                    </span>
                  </td>
                  {ENVIRONMENT_COLUMNS.map(function renderCell(column) {
                    const current = column.key === __APP_ENV__
                    return (
                      <td
                        key={column.key}
                        className={`px-3 py-2 text-center ${current ? 'bg-indigo-50 dark:bg-indigo-950' : ''}`}
                      >
                        <StatusBadge cell={row.cells[column.key]} />
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}
