import type { ReactNode } from 'react'

import { useFlag } from './flags'
import type { FlagName } from './flags'

type FeatureProps = {
  flag: FlagName
  fallback?: ReactNode
  children: ReactNode
}

export function Feature({ flag, fallback = null, children }: FeatureProps) {
  const enabled = useFlag(flag)
  if (enabled) {
    return children
  }
  return fallback
}
