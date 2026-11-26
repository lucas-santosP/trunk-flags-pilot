export type Bump = 'patch' | 'minor' | 'major'

export function parseBump(value: string | undefined): Bump {
  if (value === 'minor' || value === 'major') {
    return value
  }
  return 'patch'
}

export function bumpFromLabels(labels: string[]): Bump {
  if (labels.includes('release:major')) {
    return 'major'
  }
  if (labels.includes('release:minor')) {
    return 'minor'
  }
  return 'patch'
}

export function bumpVersion(currentTag: string | null, bump: Bump): string {
  if (!currentTag) {
    return bump === 'major' ? 'v1.0.0' : bump === 'minor' ? 'v0.1.0' : 'v0.0.1'
  }
  const match = /^v(\d+)\.(\d+)\.(\d+)$/.exec(currentTag)
  if (!match) {
    throw new Error(`Tag fora do padrão vX.Y.Z: ${currentTag}`)
  }
  const [major, minor, patch] = match.slice(1).map(Number)
  if (bump === 'major') {
    return `v${major + 1}.0.0`
  }
  if (bump === 'minor') {
    return `v${major}.${minor + 1}.0`
  }
  return `v${major}.${minor}.${patch + 1}`
}
