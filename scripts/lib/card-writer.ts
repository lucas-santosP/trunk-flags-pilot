import { upsertComputedComment } from './github.ts'
import type { CardStage, StageState } from './status-card.ts'
import { devEnabledFromEnv, markOutside, STATUS_CARD_MARKER, updateCard } from './status-card.ts'

function devEnabled(): boolean {
  return devEnabledFromEnv(process.env.ENV_DEV_ENABLED)
}

export function writeStage(
  repository: string,
  number: number,
  stage: CardStage,
  state: StageState,
  createIfMissing: boolean,
): void {
  upsertComputedComment(
    repository,
    number,
    STATUS_CARD_MARKER,
    function compute(currentBody) {
      return updateCard(currentBody, stage, state, devEnabled())
    },
    createIfMissing,
  )
}

export function markStageOutside(
  repository: string,
  number: number,
  stage: CardStage,
  state: StageState,
): void {
  upsertComputedComment(
    repository,
    number,
    STATUS_CARD_MARKER,
    function compute(currentBody) {
      return markOutside(currentBody, stage, state, devEnabled())
    },
    false,
  )
}
