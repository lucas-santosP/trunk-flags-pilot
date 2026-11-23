import { listFlags } from './flags'

const flagEntries = listFlags()

export function FlagsPanel() {
  return (
    <section className="rounded-2xl border border-slate-200 p-6 dark:border-slate-800">
      <h2 className="text-lg font-semibold">Flags neste build</h2>
      <ul className="mt-3 space-y-1 font-mono text-sm">
        {flagEntries.map(function renderFlag([name, enabled]) {
          return (
            <li key={name} className="flex items-center gap-2">
              <span className={enabled ? 'text-emerald-600' : 'text-rose-600'}>
                {enabled ? 'ON ' : 'OFF'}
              </span>
              {name}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
