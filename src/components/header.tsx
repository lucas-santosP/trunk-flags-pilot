import { EnvironmentBadge } from '../environment-badge'

export function Header() {
  return (
    <header className="flex flex-col gap-2">
      <h1 className="text-3xl font-bold">Branch Envs Pilot</h1>
      <EnvironmentBadge />
    </header>
  )
}
