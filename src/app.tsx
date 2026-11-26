import { Footer } from './components/footer'
import { Header } from './components/header'
import { EnvPanel } from './env-panel/env-panel'
import { DigitalCard } from './features/digital-card/digital-card'
import { WelcomeBanner } from './features/welcome-banner/welcome-banner'

export function App() {
  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col gap-6 px-4 py-10">
      <Header />
      <WelcomeBanner />
      <DigitalCard />
      {__APP_ENV__ !== 'production' && __ENV_PANEL__ !== null && (
        <EnvPanel config={__ENV_PANEL__} />
      )}

      <Footer />
    </main>
  )
}
