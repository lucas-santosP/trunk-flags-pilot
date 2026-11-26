import { EnvPanel } from './env-panel/env-panel'
import { EnvironmentBadge } from './environment-badge'
import { DigitalCard } from './features/digital-card/digital-card'
import { WelcomeBanner } from './features/welcome-banner/welcome-banner'

export function App() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-4 py-10">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold">Branch Envs Pilot</h1>
        <EnvironmentBadge />
      </header>
      <WelcomeBanner />
      <DigitalCard />
      {__APP_ENV__ !== 'production' && __ENV_PANEL__ !== null && (
        <EnvPanel config={__ENV_PANEL__} />
      )}
    </main>
  )
}
