import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { Feature } from './feature'
import type { FlagName } from './flags'

vi.mock('./flags', () => ({
  useFlag: (name: string) => name === 'flagLigada',
}))

describe('<Feature>', () => {
  it('renderiza children quando a flag está ligada', () => {
    render(
      <Feature flag={'flagLigada' as FlagName} fallback={<p>antigo</p>}>
        <p>novo</p>
      </Feature>,
    )
    expect(screen.getByText('novo')).toBeDefined()
    expect(screen.queryByText('antigo')).toBeNull()
  })

  it('renderiza fallback quando a flag está desligada', () => {
    render(
      <Feature flag={'flagDesligada' as FlagName} fallback={<p>legado</p>}>
        <p>recente</p>
      </Feature>,
    )
    expect(screen.getByText('legado')).toBeDefined()
    expect(screen.queryByText('recente')).toBeNull()
  })
})
