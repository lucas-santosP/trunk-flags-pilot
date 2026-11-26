import { execFileSync } from 'node:child_process'

import { parseCommitSubject } from '../../shared/env-manifest.ts'
import type { HistoryEntry } from '../../shared/env-manifest.ts'

export function git(args: string[]): string {
  return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
}

export function tryGit(args: string[]): boolean {
  try {
    git(args)
    return true
  } catch {
    return false
  }
}

export function nearestVersionTag(): string | null {
  try {
    return git(['describe', '--tags', '--abbrev=0', '--match', 'v[0-9]*.[0-9]*.[0-9]*', 'HEAD'])
  } catch {
    return null
  }
}

export function tagExists(tag: string): boolean {
  return tryGit(['rev-parse', '--verify', '--quiet', `refs/tags/${tag}`])
}

export function isAncestor(ancestor: string, descendant: string): boolean {
  return tryGit(['merge-base', '--is-ancestor', ancestor, descendant])
}

export function firstParentCommits(from: string, to: string): string[] {
  const output = git(['rev-list', '--first-parent', '--reverse', `${from}..${to}`])
  return output ? output.split('\n') : []
}

const FIELD_SEPARATOR = '\x1f'

const RECORD_SEPARATOR = '\x1e'

export function readMainHistory(ref: string, limit: number): HistoryEntry[] {
  let output: string
  try {
    output = git([
      'log',
      '--first-parent',
      `-${limit}`,
      `--format=%H${FIELD_SEPARATOR}%s${FIELD_SEPARATOR}%b${RECORD_SEPARATOR}`,
      ref,
    ])
  } catch {
    return []
  }
  return output
    .split(RECORD_SEPARATOR)
    .map(function trimRecord(record) {
      return record.trim()
    })
    .filter(Boolean)
    .map(function toEntry(record) {
      const [sha, subject, body = ''] = record.split(FIELD_SEPARATOR)
      return { sha, ...parseCommitSubject(subject, body) }
    })
}
