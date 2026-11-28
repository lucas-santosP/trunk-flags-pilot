import { writeStage } from './lib/card-writer.ts'
import { HOTFIX_LABEL } from './lib/env-plan.ts'
import { STATUS_CONTEXTS } from './lib/env-status.ts'
import {
  collaboratorRole,
  commitStatusOf,
  createComment,
  currentRepository,
  currentRunUrl,
  fetchOpenPullRequests,
  removeLabel,
  setCommitStatus,
} from './lib/github.ts'
import { hotfixAction, parseAllowedRoles, waiverDescription } from './lib/hotfix.ts'

function main(): void {
  const repository = currentRepository()
  const context = STATUS_CONTEXTS.homol
  const allowedRoles = parseAllowedRoles(process.env.HOTFIX_ALLOWED_ROLES)
  const roles = new Map<string, string | null>()

  function roleOf(login: string): string | null {
    if (!roles.has(login)) {
      roles.set(login, collaboratorRole(repository, login))
    }
    return roles.get(login) ?? null
  }

  const pullRequests = fetchOpenPullRequests(repository).filter(function isSameRepository(item) {
    return !item.isCrossRepository
  })

  for (const pullRequest of pullRequests) {
    const current = commitStatusOf(repository, pullRequest.headSha, context)
    const action = hotfixAction(
      {
        labels: pullRequest.labels,
        hotfixLabeledBy: pullRequest.hotfixLabeledBy,
        currentDescription: current?.description ?? null,
        currentState: current?.state ?? null,
      },
      roleOf,
      allowedRoles,
    )

    if (action.kind === 'waive') {
      setCommitStatus(
        repository,
        pullRequest.headSha,
        context,
        'success',
        waiverDescription(action.by),
        currentRunUrl(),
      )
      writeStage(
        repository,
        pullRequest.number,
        'homol',
        { kind: 'waived', text: `dispensado (hotfix por @${action.by})` },
        true,
      )
      console.log(`#${pullRequest.number}: homol dispensado (hotfix por @${action.by})`)
    } else if (action.kind === 'reject') {
      removeLabel(repository, pullRequest.number, HOTFIX_LABEL)
      const author = action.by ? `@${action.by}` : 'quem aplicou o label'
      createComment(
        repository,
        pullRequest.number,
        `⚠️ Label \`${HOTFIX_LABEL}\` removido: ${author} não tem permissão (${allowedRoles.join(' ou ')}). O hotfix dispensa homol e precisa ser aplicado por um techlead.`,
      )
      console.log(`#${pullRequest.number}: hotfix recusado`)
    } else if (action.kind === 'revoke') {
      setCommitStatus(
        repository,
        pullRequest.headSha,
        context,
        'pending',
        'Hotfix removido: a PR precisa passar por homol',
        currentRunUrl(),
      )
      writeStage(
        repository,
        pullRequest.number,
        'homol',
        { kind: 'out', text: 'hotfix removido' },
        false,
      )
      console.log(`#${pullRequest.number}: dispensa de homol revogada`)
    }
  }
}

main()
