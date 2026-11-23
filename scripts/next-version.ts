import { bumpVersion } from './lib/flags-rules.ts'
import type { Bump } from './lib/flags-rules.ts'
import { nearestVersionTag, tagExists } from './lib/git.ts'

function parseBump(value: string | undefined): Bump {
  if (value === 'minor' || value === 'major') {
    return value
  }
  return 'patch'
}

function main(): void {
  const next = bumpVersion(nearestVersionTag(), parseBump(process.argv[2]))
  if (tagExists(next)) {
    console.error(`A tag ${next} já existe. Escolha outro bump ou verifique a branch de origem.`)
    process.exit(1)
  }
  console.log(next)
}

main()
