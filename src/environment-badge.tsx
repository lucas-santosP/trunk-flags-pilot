const ENVIRONMENT_STYLES: Record<typeof __APP_ENV__, string> = {
  dev: 'bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200',
  homol: 'bg-sky-100 text-sky-900 dark:bg-sky-900/40 dark:text-sky-200',
  production: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200',
}

export function EnvironmentBadge() {
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className={`rounded-full px-3 py-1 font-semibold ${ENVIRONMENT_STYLES[__APP_ENV__]}`}>
        {__APP_ENV__}
      </span>
      <span className="font-mono text-slate-500">{__APP_VERSION__}</span>
      <span className="font-mono text-slate-400">{__COMMIT_SHA__.slice(0, 7)}</span>
    </div>
  )
}
