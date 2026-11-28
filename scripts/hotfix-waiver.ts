import { writeStage } from './lib/card-writer.ts'
import { HOTFIX_LABEL } from './lib/env-plan.ts'
import { STATUS_CONTEXTS } from './lib/env-status.ts'
import {
  collaboratorRole,
  commitStatusOf,
  createComment,
  currentRepository,
  currentRunUrl,
  removeLabel,
  setCommitStatus,
} from './lib/github.ts'
import type { LabelEvent } from './lib/hotfix.ts'
import { hotfixAction, parseAllowedRoles, waiverDescription } from './lib/hotfix.ts'

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    console.error(`::error::${name} não definido`)
    process.exit(1)
  }
  return value
}

function main(): void {
  const repository = currentRepository()
  const event = requireEnv('LABEL_ACTION') as LabelEvent
  const actor = requireEnv('LABEL_ACTOR')
  const number = Number(requireEnv('PR_NUMBER'))
  const headSha = requireEnv('PR_HEAD_SHA')
  const context = STATUS_CONTEXTS.homol
  const allowedRoles = parseAllowedRoles(process.env.HOTFIX_ALLOWED_ROLES)

  const current = commitStatusOf(repository, headSha, context)
  const action = hotfixAction(
    {
      event,
      actorRole: event === 'labeled' ? collaboratorRole(repository, actor) : null,
      currentState: current?.state ?? null,
      currentDescription: current?.description ?? null,
    },
    allowedRoles,
  )

  if (action.kind === 'waive') {
    setCommitStatus(
      repository,
      headSha,
      context,
      'success',
      waiverDescription(actor),
      currentRunUrl(),
    )
    writeStage(
      repository,
      number,
      'homol',
      {
        kind: 'waived',
        text: `dispensado para o commit \`${headSha.slice(0, 7)}\` (hotfix por @${actor}). Push novo exige reaplicar o label`,
      },
      true,
    )
    console.log(`#${number}: homol dispensado para ${headSha.slice(0, 7)} (hotfix por @${actor})`)
  } else if (action.kind === 'reject') {
    removeLabel(repository, number, HOTFIX_LABEL)
    createComment(
      repository,
      number,
      `⚠️ Label \`${HOTFIX_LABEL}\` removido: @${actor} não tem permissão (${allowedRoles.join(' ou ')}). O hotfix dispensa homol e precisa ser aplicado por um techlead.`,
    )
    console.log(`#${number}: hotfix recusado para @${actor}`)
  } else if (action.kind === 'revoke') {
    setCommitStatus(
      repository,
      headSha,
      context,
      'pending',
      'Hotfix removido: a PR precisa passar por homol',
      currentRunUrl(),
    )
    writeStage(repository, number, 'homol', { kind: 'out', text: 'hotfix removido' }, false)
    console.log(`#${number}: dispensa de homol revogada`)
  } else {
    console.log(`#${number}: nada a fazer`)
  }
}

main()
