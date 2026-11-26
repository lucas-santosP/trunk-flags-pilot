export function DigitalCard() {
  return (
    <section className="flex flex-col gap-4 sm:flex-row sm:items-center">
      <div className="relative aspect-[1.586] w-full max-w-sm overflow-hidden rounded-2xl bg-linear-to-br from-emerald-500 via-teal-600 to-cyan-700 p-5 text-white shadow-xl">
        <div className="absolute -top-10 -right-10 size-40 rounded-full bg-white/10" />
        <div className="absolute -bottom-16 -left-8 size-48 rounded-full bg-white/10" />
        <div className="relative flex h-full flex-col justify-between">
          <div className="flex items-start justify-between">
            <span className="text-sm font-semibold tracking-wide uppercase">Cartão digital</span>
            <span className="rounded-md bg-white/20 px-2 py-0.5 text-xs">fictício</span>
          </div>
          <div>
            <p className="font-mono text-lg tracking-widest">0000 0000 0000 0000</p>
            <div className="mt-2 flex justify-between text-xs uppercase opacity-90">
              <span>Membro Exemplo</span>
              <span>val. 12/99</span>
            </div>
          </div>
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium tracking-wide text-emerald-600 uppercase">Feature</p>
        <h2 className="text-xl font-semibold">Seu cartão, agora no app</h2>
        <p className="text-slate-600 dark:text-slate-400">Dados 100% fictícios.</p>
      </div>
    </section>
  )
}
