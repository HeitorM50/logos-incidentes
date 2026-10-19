import { QueryClientProvider } from '@tanstack/react-query'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { encerrarSessao, lerSessao, notificarSessaoExpirada, salvarSessao } from '@/api/sessao'
import { criarClienteDeConsultas } from '@/lib/consultas'
import App from './App'

function renderizar() {
  const cliente = criarClienteDeConsultas()
  cliente.setDefaultOptions({ queries: { retry: false } })
  return render(
    <QueryClientProvider client={cliente}>
      <App />
    </QueryClientProvider>,
  )
}

function entrarComoAna() {
  salvarSessao({
    token: 'jwt',
    expiraEm: new Date(Date.now() + 3_600_000).toISOString(),
    analista: { id: 1, nome: 'Ana Souza', usuario: 'ana' },
  })
}

beforeEach(() => {
  encerrarSessao()
  vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})))
})
afterEach(() => vi.unstubAllGlobals())

describe('App', () => {
  it('abre no login quando não há sessão', () => {
    renderizar()

    expect(screen.getByRole('heading', { name: 'Entrar na central' })).toBeInTheDocument()
  })

  it('abre direto na central quando a sessão salva ainda vale', () => {
    entrarComoAna()
    renderizar()

    expect(screen.getByText('Ana Souza')).toBeInTheDocument()
  })

  it('volta ao login e apaga a sessão ao sair', async () => {
    entrarComoAna()
    renderizar()

    await userEvent.click(screen.getByRole('button', { name: 'Sair' }))

    expect(screen.getByRole('heading', { name: 'Entrar na central' })).toBeInTheDocument()
    expect(lerSessao()).toBeNull()
  })

  it('volta ao login quando a API recusa o token', () => {
    entrarComoAna()
    renderizar()

    act(() => notificarSessaoExpirada())

    expect(screen.getByRole('heading', { name: 'Entrar na central' })).toBeInTheDocument()
  })
})
