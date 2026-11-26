import type { AppEnvironment } from '../../shared/env-manifest.ts'

export function resolveEnvironment(mode: string): AppEnvironment {
  if (mode === 'homol' || mode === 'production') {
    return mode
  }
  return 'dev'
}

export function environmentUrls(
  pagesProject: string | undefined,
): Record<AppEnvironment, string> | null {
  if (!pagesProject) {
    return null
  }
  return {
    dev: `https://dev.${pagesProject}.pages.dev`,
    homol: `https://homol.${pagesProject}.pages.dev`,
    production: `https://${pagesProject}.pages.dev`,
  }
}
