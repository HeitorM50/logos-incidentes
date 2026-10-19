import { QueryClientProvider } from '@tanstack/react-query'
import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { criarClienteDeConsultas } from '@/lib/consultas'
import { ANA, erroDaApi, incidente, lista, nunca, respostaJson } from '@/test/fabricas'
import { TelaTriagem } from './TelaTriagem'
import { estadoDaConexao } from './useIncidentes'

function simularLista(responder: () => Promise<Response>) {
  const fetchFalso = vi.fn<typeof fetch>(() => responder())
  vi.stubGlobal('fetch', fetchFalso)
  return fetchFalso
}

function renderizar() {
  const cliente = criarClienteDeConsultas()
  cliente.setDefaultOptions({ queries: { retry: false } })
  render(
    <QueryClientProvider client={cliente}>
      <TelaTriagem analista={ANA} aoSair={() => {}} />
    </QueryClientProvider>,
  )
}

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('TelaTriagem', () => {
  it('mostra os incidentes na ordem da API e os contadores dos ativos', async () => {
    simularLista(async () =>
      respostaJson(
        200,
        lista([
          incidente({ id: 7, titulo: 'Capotamento com vítima', criticidade: 'alta' }),
          incidente({ id: 3, titulo: 'Neblina densa', criticidade: 'baixa', responsavel: ANA }),
          incidente({ id: 9, titulo: 'Pane resolvida', criticidade: 'alta', status: 'fechado' }),
        ]),
      ),
    )
    renderizar()

    const linhas = within(await screen.findByRole('list', { name: 'Incidentes' })).getAllByRole(
      'listitem',
    )
    expect(linhas.map((l) => within(l).getByText(/^#\d+$/).textContent)).toEqual(['#7', '#3', '#9'])
    expect(within(linhas[1]).getByText('Você')).toBeInTheDocument()
    expect(within(linhas[0]).getByText('há 30 min')).toBeInTheDocument()

    // O fechado aparece na lista, mas não conta como ativo.
    expect(screen.getByText('2 incidentes ativos · 1 fechados')).toBeInTheDocument()
    const cartoes = within(screen.getByRole('list', { name: /por criticidade/ })).getAllByRole(
      'listitem',
    )
    expect(cartoes[0]).toHaveTextContent(/Alta.*1$/)
    expect(cartoes[1]).toHaveTextContent('Nenhum ativo')
  })

  it('abre os detalhes da linha', async () => {
    simularLista(async () =>
      respostaJson(200, lista([incidente({ id: 4, descricao: 'Carreta parada', placa: 'RTA4E21' })])),
    )
    renderizar()

    await userEvent.click(await screen.findByRole('button', { name: 'Ver detalhes de #4' }))

    const detalhes = screen.getByRole('region', { name: 'Detalhes de #4' })
    expect(detalhes).toHaveTextContent('Carreta parada')
    expect(detalhes).toHaveTextContent('RTA4E21')
  })

  it('mostra o esqueleto com o loader enquanto a primeira leitura não chega', () => {
    simularLista(nunca)
    renderizar()

    expect(screen.getByText('Carregando incidentes…', { selector: 'p' })).toBeInTheDocument()
    expect(screen.getByText('Sincronizando…')).toBeInTheDocument()
  })

  it('troca para "acordando o servidor" quando a primeira leitura demora', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    simularLista(nunca)
    renderizar()

    await act(() => vi.advanceTimersByTimeAsync(3_000))

    expect(screen.getByRole('heading', { name: 'Acordando o servidor…' })).toBeInTheDocument()
    expect(screen.getByText('Aguardando o servidor responder')).toBeInTheDocument()
  })

  it('mostra o erro com "Tentar de novo" e recarrega', async () => {
    const fetchFalso = simularLista(async () => erroDaApi(503, 'servico_indisponivel'))
    renderizar()

    const painel = await screen.findByRole('alert')
    expect(painel).toHaveTextContent('Não foi possível carregar os incidentes')
    expect(painel).toHaveTextContent('erro 503')

    fetchFalso.mockImplementation(async () => respostaJson(200, lista([incidente()])))
    await userEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }))

    expect(await screen.findByRole('list', { name: 'Incidentes' })).toBeInTheDocument()
  })

  it('mantém o painel de erro durante a nova tentativa automática', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const fetchFalso = simularLista(async () => erroDaApi(503, 'servico_indisponivel'))
    renderizar()
    const painel = await screen.findByRole('alert')

    // A próxima leitura do polling fica pendurada: o painel não pode virar esqueleto.
    fetchFalso.mockImplementation(nunca)
    await act(() => vi.advanceTimersByTimeAsync(5_000))

    expect(screen.getByRole('alert')).toBe(painel)
    expect(painel).toHaveTextContent('erro 503')
    expect(screen.getByRole('button', { name: 'Tentando…' })).toBeDisabled()
  })

  it('mostra o estado vazio', async () => {
    simularLista(async () => respostaJson(200, lista([])))
    renderizar()

    expect(await screen.findByText('Nenhum incidente ativo')).toBeInTheDocument()
  })

  it('relê a lista a cada 5 s e avisa quando a conexão cai', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const fetchFalso = simularLista(async () =>
      respostaJson(200, lista([incidente({ titulo: 'Primeira leitura' })])),
    )
    renderizar()
    await screen.findByText('Primeira leitura')
    expect(screen.getByText('Ao vivo')).toBeInTheDocument()

    fetchFalso.mockImplementation(async () =>
      respostaJson(200, lista([incidente({ titulo: 'Segunda leitura' })])),
    )
    await act(() => vi.advanceTimersByTimeAsync(5_000))
    expect(screen.getByText('Segunda leitura')).toBeInTheDocument()

    fetchFalso.mockImplementation(() => Promise.reject(new TypeError('rede caiu')))
    await act(() => vi.advanceTimersByTimeAsync(5_000))

    expect(screen.getByText('Conexão perdida. Reconectando…')).toBeInTheDocument()
    // A lista anterior continua na tela enquanto reconecta.
    expect(screen.getByText('Segunda leitura')).toBeInTheDocument()

    fetchFalso.mockImplementation(async () =>
      respostaJson(200, lista([incidente({ titulo: 'Conexão de volta' })])),
    )
    await act(() => vi.advanceTimersByTimeAsync(5_000))

    expect(screen.getByText('Conexão de volta')).toBeInTheDocument()
    expect(screen.queryByText('Conexão perdida. Reconectando…')).not.toBeInTheDocument()
    expect(screen.getByText('Ao vivo')).toBeInTheDocument()
  })
})

describe('estadoDaConexao', () => {
  const base = { data: undefined, isError: false, failureCount: 0, errorUpdateCount: 0 }
  const ociosa = 'idle' as const

  it.each([
    [{ ...base, fetchStatus: 'fetching' as const }, 'sincronizando'],
    [{ ...base, isError: true, failureCount: 1, errorUpdateCount: 1, fetchStatus: ociosa }, 'sem_conexao'],
    // Nova tentativa sem dados: o TanStack volta para "pending", mas a falha anterior conta.
    [{ ...base, errorUpdateCount: 1, fetchStatus: 'fetching' as const }, 'sem_conexao'],
    // Sem internet, a leitura pausa e não registra falha.
    [{ ...base, fetchStatus: 'paused' as const }, 'sem_conexao'],
    [{ ...base, data: {}, fetchStatus: ociosa }, 'ao_vivo'],
    [{ ...base, data: {}, failureCount: 1, fetchStatus: 'fetching' as const }, 'reconectando'],
    [{ ...base, data: {}, isError: true, failureCount: 3, fetchStatus: ociosa }, 'reconectando'],
    [{ ...base, data: {}, fetchStatus: 'paused' as const }, 'reconectando'],
  ])('%o → %s', (consulta, esperado) => {
    expect(estadoDaConexao(consulta)).toBe(esperado)
  })
})
