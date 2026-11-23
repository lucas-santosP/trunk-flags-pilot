export function LegacyGreeting() {
  return (
    <section className="rounded-2xl border border-slate-300 p-6 dark:border-slate-700">
      <h2 className="text-xl font-semibold">Olá!</h2>
      <p className="mt-2 text-slate-600 dark:text-slate-400">Saudação antiga (fallback da flag).</p>
    </section>
  )
}
