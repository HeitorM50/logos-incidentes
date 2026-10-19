import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { LogosLoader } from './LogosLoader'

describe('LogosLoader', () => {
  it('anuncia a legenda ao leitor de tela', () => {
    render(<LogosLoader legenda="Carregando incidentes…" />)

    expect(screen.getByRole('status', { name: 'Carregando incidentes…' })).toBeInTheDocument()
  })

  it('anuncia "Carregando" quando não há legenda', () => {
    render(<LogosLoader tamanho={14} />)

    expect(screen.getByRole('status')).toHaveTextContent('Carregando')
  })

  it('fica fora da árvore de acessibilidade quando é decorativo', () => {
    render(<LogosLoader decorativo />)

    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })
})
