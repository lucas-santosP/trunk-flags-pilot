import { MemberCard } from '../member-card/member-card'

export function CardPreview() {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-lg font-semibold">Prévia da carteirinha</h2>
      <MemberCard />
    </section>
  )
}
