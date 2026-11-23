import { listFlagMatrix } from './flags'

const ENVIRONMENT_COLUMNS = [
  { key: 'dev', label: 'dev' },
  { key: 'homol', label: 'homol' },
  { key: 'production', label: 'prod' },
] as const

const rows = listFlagMatrix()

function StatusBadge({ enabled }: { enabled: boolean }) {
  return (
    <span
      className={`inline-flex min-w-12 justify-center rounded-full px-2 py-0.5 text-xs font-semibold ${
        enabled
          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200'
          : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
      }`}
    >
      {enabled ? 'ON' : 'OFF'}
    </span>
  )
}

export function FlagsPanel() {
  return (
    <section className="rounded-2xl border border-slate-200 p-6 dark:border-slate-800">
      <h2 className="text-lg font-semibold">Flags por ambiente</h2>
      <p className="mt-1 text-sm text-slate-500">
        Estado das flags no commit deste build. A coluna destacada é o ambiente atual.
      </p>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-500">
              <th className="py-2 pr-4 font-medium">Flag</th>
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
                <tr key={row.name} className="border-t border-slate-100 dark:border-slate-800">
                  <td className="py-2 pr-4 font-mono">{row.name}</td>
                  {ENVIRONMENT_COLUMNS.map(function renderCell(column) {
                    const current = column.key === __APP_ENV__
                    return (
                      <td
                        key={column.key}
                        className={`px-3 py-2 text-center ${current ? 'bg-indigo-50 dark:bg-indigo-950' : ''}`}
                      >
                        <StatusBadge enabled={row[column.key]} />
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
