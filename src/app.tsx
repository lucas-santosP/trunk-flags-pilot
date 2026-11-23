import { EnvironmentBadge } from './environment-badge'
import { LegacyGreeting } from './features/legacy-greeting/legacy-greeting'
import { DigitalCard } from './features/digital-card/digital-card'
import { WelcomeBanner } from './features/welcome-banner/welcome-banner'
import { FlagsPanel } from './flags-panel'
import { Feature } from './flags'

export function App() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-4 py-10">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold">Trunk Flags Pilot</h1>
        <EnvironmentBadge />
      </header>
      <Feature flag="bannerBoasVindas" fallback={<LegacyGreeting />}>
        <WelcomeBanner />
      </Feature>
      <Feature flag="cartaoDigital">
        <DigitalCard />
      </Feature>
      <FlagsPanel />
    </main>
  )
}
