import { QueryClientProvider } from '@tanstack/react-query'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { encerrarSessao, lerSessao, notificarSessaoExpirada, salvarSessao } from '@/api/sessao'
import { criarClienteDeConsultas } from '@/lib/consultas'
import { ANA, respostaJson } from '@/test/fabricas'
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
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

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

  it('mostra a abertura da central depois do login e a remove após um ciclo', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.stubGlobal(
      'fetch',
      vi.fn((entrada: RequestInfo | URL) =>
        String(entrada).endsWith('/auth/login')
          ? Promise.resolve(
              respostaJson(200, {
                token: 'jwt',
                expira_em: new Date(Date.now() + 3_600_000).toISOString(),
                analista: ANA,
              }),
            )
          : new Promise(() => {}),
      ),
    )
    renderizar()

    await userEvent.click(screen.getByRole('button', { name: 'Preencher' }))
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }))

    expect(await screen.findByRole('status', { name: 'Abrindo a central…' })).toBeInTheDocument()
    await act(() => vi.advanceTimersByTimeAsync(2_000))
    await act(() => vi.advanceTimersByTimeAsync(400))
    expect(screen.queryByRole('status', { name: 'Abrindo a central…' })).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Triagem' })).toBeInTheDocument()
  })

  it('volta ao login quando a API recusa o token', () => {
    entrarComoAna()
    renderizar()

    act(() => notificarSessaoExpirada())

    expect(screen.getByRole('heading', { name: 'Entrar na central' })).toBeInTheDocument()
  })
})
