import { nearestVersionTag, tagExists } from './lib/git.ts'
import { bumpVersion, parseBump } from './lib/version.ts'

function main(): void {
  const next = bumpVersion(nearestVersionTag(), parseBump(process.argv[2]))
  if (tagExists(next)) {
    console.error(`A tag ${next} já existe. Escolha outro bump ou verifique a branch de origem.`)
    process.exit(1)
  }
  console.log(next)
}

main()
