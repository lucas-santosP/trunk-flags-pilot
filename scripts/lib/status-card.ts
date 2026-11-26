export const STATUS_CARD_MARKER = '<!-- pr-status-card'

export type StageKind = 'live' | 'approval' | 'skipped' | 'out'

export type StageState = { kind: StageKind; text: string }

export type CardStage = 'dev' | 'homol' | 'production'

export type CardState = {
  devEnabled: boolean
  dev?: StageState
  homol?: StageState
  production?: StageState
}

const STAGE_ICONS: Record<CardStage, Record<StageKind, string>> = {
  dev: { live: '✅', approval: '⏳', skipped: '⚠️', out: '⬜' },
  homol: { live: '✅', approval: '⏳', skipped: '⚠️', out: '⬜' },
  production: { live: '🚀', approval: '⏳', skipped: '⚠️', out: '—' },
}

const STATE_PATTERN = /<!-- pr-status-card:([A-Za-z0-9+/=]+) -->/

export function parseCard(body: string | null): CardState | null {
  if (!body) {
    return null
  }
  const match = STATE_PATTERN.exec(body)
  if (!match) {
    return null
  }
  try {
    return JSON.parse(Buffer.from(match[1], 'base64').toString('utf8')) as CardState
  } catch {
    return null
  }
}

function renderStage(stage: CardStage, state: StageState | undefined, fallback: string): string {
  if (!state) {
    return fallback
  }
  return `${STAGE_ICONS[stage][state.kind]} ${state.text}`
}

function mergeRow(state: CardState): string {
  if (state.production) {
    return '✅ mergeada'
  }
  if (state.homol?.kind === 'live') {
    return '✅ **Próximo passo:** pode fazer o merge'
  }
  return '🔒 liberado após homol'
}

function homolFallback(state: CardState): string {
  if (state.devEnabled && state.dev?.kind === 'skipped') {
    return '⬜ resolva o problema apontado em dev antes de aplicar o label `homol`'
  }
  if (state.devEnabled && state.dev?.kind !== 'live') {
    return '⬜ aplique o label `homol` quando a PR estiver pronta para QA'
  }
  return '⬜ **Próximo passo:** aplique o label `homol`'
}

export function renderCard(state: CardState): string {
  const rows: [string, string][] = []
  if (state.devEnabled) {
    rows.push(['dev', renderStage('dev', state.dev, '⬜ aguardando CI verde e PR fora de draft')])
  }
  const homol =
    state.homol?.kind === 'out' && !state.production
      ? `${renderStage('homol', state.homol, '')} · aplique o label \`homol\` para voltar`
      : renderStage('homol', state.homol, homolFallback(state))
  rows.push(['homol', homol])
  rows.push(['merge', mergeRow(state)])
  rows.push(['produção', renderStage('production', state.production, '—')])

  const encoded = Buffer.from(JSON.stringify(state), 'utf8').toString('base64')
  return [
    `${STATUS_CARD_MARKER}:${encoded} -->`,
    '### Fluxo desta PR',
    '',
    '| Etapa | Status |',
    '| --- | --- |',
    ...rows.map(function toRow([stage, status]) {
      return `| ${stage} | ${status.replaceAll('|', '\\|')} |`
    }),
    '',
    '<sub>Atualizado automaticamente pelos workflows de deploy.</sub>',
  ].join('\n')
}

export function updateCard(
  body: string | null,
  stage: CardStage,
  stageState: StageState,
  devEnabled: boolean | null,
): string {
  const current = parseCard(body) ?? { devEnabled: devEnabled ?? true }
  const next: CardState = {
    ...current,
    devEnabled: devEnabled ?? current.devEnabled,
    [stage]: stageState,
  }
  return renderCard(next)
}

export function markOutside(
  body: string | null,
  stage: CardStage,
  stageState: StageState,
  devEnabled: boolean | null,
): string | null {
  const current = parseCard(body)
  const previous = current?.[stage]
  if (!current || !previous || previous.kind === 'out') {
    return null
  }
  return updateCard(body, stage, stageState, devEnabled)
}

export const DEV_WORKFLOW_PATH = '.github/workflows/deploy-dev.yml'
