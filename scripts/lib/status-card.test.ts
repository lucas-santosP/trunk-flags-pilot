import { describe, expect, it } from 'vitest'

import { markOutside, markRolledBack, parseCard, renderCard, updateCard } from './status-card.ts'

describe('status card', () => {
  it('cria o cartão pedindo o label homol depois de dev', () => {
    const body = updateCard(null, 'dev', { kind: 'live', text: 'no ar em `dev-1`' }, true)
    expect(body).toContain('| dev | ✅ no ar em `dev-1` |')
    expect(body).toContain('**Próximo passo:** aplique o label `homol`')
    expect(body).toContain('🔒 liberado após homol')
  })

  it('preserva as outras etapas ao atualizar uma', () => {
    const withDev = updateCard(null, 'dev', { kind: 'live', text: 'dev ok' }, true)
    const withHomol = updateCard(withDev, 'homol', { kind: 'live', text: 'homol ok' }, true)
    expect(parseCard(withHomol)).toMatchObject({
      dev: { text: 'dev ok' },
      homol: { text: 'homol ok' },
    })
    expect(withHomol).toContain('**Próximo passo:** pode fazer o merge')
  })

  it('orienta resolver o problema de dev antes de homol', () => {
    const body = updateCard(null, 'dev', { kind: 'skipped', text: 'conflita com #1' }, true)
    expect(body).toContain('resolva o problema apontado em dev antes de aplicar o label `homol`')
  })

  it('esconde dev quando o ambiente está desligado', () => {
    const body = updateCard(null, 'homol', { kind: 'approval', text: 'aguardando' }, false)
    expect(body).not.toContain('| dev |')
    expect(body).toContain('| homol | ⏳ aguardando |')
  })

  it('mostra produção e merge concluído', () => {
    const body = renderCard({
      devEnabled: true,
      homol: { kind: 'live', text: 'homol ok' },
      production: { kind: 'live', text: 'em produção na `v1.0.0`' },
    })
    expect(body).toContain('| merge | ✅ mergeada |')
    expect(body).toContain('| produção | 🚀 em produção na `v1.0.0` |')
  })

  it('escapa barras verticais no texto', () => {
    const body = renderCard({ devEnabled: false, homol: { kind: 'skipped', text: 'a | b' } })
    expect(body).toContain(String.raw`a \| b`)
  })
})

describe('hotfix', () => {
  it('libera o merge com homol dispensado', () => {
    const body = updateCard(
      null,
      'homol',
      { kind: 'waived', text: 'dispensado (hotfix por @lider)' },
      true,
    )
    expect(body).toContain('| homol | ⏭️ dispensado (hotfix por @lider) |')
    expect(body).toContain('**Próximo passo:** pode fazer o merge')
  })
})

describe('markOutside', () => {
  it('marca fora só quando a etapa estava ativa', () => {
    const live = updateCard(null, 'homol', { kind: 'live', text: 'homol ok' }, false)
    const outside = markOutside(live, 'homol', { kind: 'out', text: 'fora' }, false)
    expect(outside).toContain('⬜ fora · aplique o label `homol` para voltar')
    expect(outside).toContain('🔒 liberado após homol')
    expect(markOutside(outside, 'homol', { kind: 'out', text: 'fora de novo' }, false)).toBeNull()
  })

  it('não cria nem altera cartão sem a etapa', () => {
    expect(markOutside(null, 'homol', { kind: 'out', text: 'fora' }, true)).toBeNull()
    const devOnly = updateCard(null, 'dev', { kind: 'live', text: 'dev ok' }, true)
    expect(markOutside(devOnly, 'homol', { kind: 'out', text: 'fora' }, true)).toBeNull()
  })
})

describe('markRolledBack', () => {
  it('marca só PRs que estavam em produção', () => {
    const live = updateCard(
      null,
      'production',
      { kind: 'live', text: 'em produção na `v2`' },
      false,
    )
    const reverted = markRolledBack(live, { kind: 'skipped', text: 'revertida para `v1`' }, false)
    expect(reverted).toContain('| produção | ⚠️ revertida para `v1` |')
    const pending = updateCard(null, 'production', { kind: 'approval', text: 'aguardando' }, false)
    expect(markRolledBack(pending, { kind: 'skipped', text: 'revertida' }, false)).toBeNull()
    expect(markRolledBack(null, { kind: 'skipped', text: 'revertida' }, false)).toBeNull()
  })
})
