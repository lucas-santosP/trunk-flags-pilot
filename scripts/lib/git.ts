import { execFileSync } from 'node:child_process'

export function git(args: string[]): string {
  return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
}

export function readFileAtRef<T>(ref: string, path: string, fallback: T): T {
  try {
    return JSON.parse(git(['show', `${ref}:${path}`])) as T
  } catch {
    return fallback
  }
}

export function changedFilesSince(baseRef: string): string[] {
  const output = git(['diff', '--name-only', `${baseRef}...HEAD`])
  return output ? output.split('\n') : []
}

export type FileCommit = {
  sha: string
  date: string
}

export function commitsTouching(path: string): FileCommit[] {
  let output: string
  try {
    output = git(['log', '--format=%H%x09%cI', '--', path])
  } catch {
    return []
  }
  if (!output) {
    return []
  }
  return output.split('\n').map(function toCommit(line) {
    const [sha, date] = line.split('\t')
    return { sha, date }
  })
}

export function nearestVersionTag(): string | null {
  try {
    return git(['describe', '--tags', '--abbrev=0', '--match', 'v[0-9]*.[0-9]*.[0-9]*', 'HEAD'])
  } catch {
    return null
  }
}

export function tagExists(tag: string): boolean {
  try {
    git(['rev-parse', '--verify', '--quiet', `refs/tags/${tag}`])
    return true
  } catch {
    return false
  }
}
