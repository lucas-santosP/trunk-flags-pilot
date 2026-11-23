export function WelcomeBanner() {
  return (
    <section className="rounded-2xl bg-linear-to-r from-indigo-600 to-violet-600 p-6 text-white shadow-lg">
      <p className="text-sm font-medium tracking-wide uppercase opacity-80">Novidade</p>
      <h2 className="mt-1 text-2xl font-semibold">Bem-vindo ao novo portal fictício</h2>
      <p className="mt-2 opacity-90">
        Este banner está atrás da flag <code className="font-mono">bannerBoasVindas</code>.
      </p>
    </section>
  )
}
