import { upsertComputedComment } from './github.ts'
import type { CardStage, StageState } from './status-card.ts'
import { tryGit } from './git.ts'
import {
  DEV_WORKFLOW_PATH,
  markOutside,
  markRolledBack,
  STATUS_CARD_MARKER,
  updateCard,
} from './status-card.ts'

function devEnabled(): boolean {
  return tryGit(['cat-file', '-e', `origin/main:${DEV_WORKFLOW_PATH}`])
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

export function markProductionRolledBack(
  repository: string,
  number: number,
  state: StageState,
): void {
  upsertComputedComment(
    repository,
    number,
    STATUS_CARD_MARKER,
    function compute(currentBody) {
      return markRolledBack(currentBody, state, devEnabled())
    },
    false,
  )
}
