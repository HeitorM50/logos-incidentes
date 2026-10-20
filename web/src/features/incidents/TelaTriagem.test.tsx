import { QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { criarClienteDeConsultas } from '@/lib/consultas'
import { ANA, BRUNO, erroDaApi, incidente, lista, nunca, respostaJson } from '@/test/fabricas'
import { TelaTriagem } from './TelaTriagem'
import { estadoDaConexao } from './useIncidentes'

function simularLista(responder: () => Promise<Response>) {
  // O histórico (aberto nos detalhes) tem rota própria; nestes testes ele vem vazio.
  const fetchFalso = vi.fn<typeof fetch>(async (entrada) =>
    String(entrada).includes('/eventos') ? respostaJson(200, []) : responder(),
  )
  vi.stubGlobal('fetch', fetchFalso)
  return fetchFalso
}

function renderizar() {
  const cliente = criarClienteDeConsultas()
  cliente.setDefaultOptions({ queries: { retry: false } })
  return render(
    <QueryClientProvider client={cliente}>
      <TelaTriagem analista={ANA} aoSair={() => {}} />
    </QueryClientProvider>,
  )
}

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  window.history.replaceState(null, '', '/')
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

    const linhas = [
      ...(await screen.findByRole('table', { name: 'Incidentes' })).querySelectorAll<HTMLElement>(
        '[data-incidente]',
      ),
    ]
    expect(linhas.map((l) => within(l).getByText(/^#\d+$/).textContent)).toEqual(['#7', '#3'])
    expect(within(linhas[1]).getByText('Você')).toBeInTheDocument()
    expect(within(linhas[0]).getByText('há 30 min')).toBeInTheDocument()

    // Tabela em ARIA: o leitor de tela anuncia o cabeçalho de cada coluna.
    const tabela = screen.getByRole('table', { name: 'Incidentes' })
    expect(within(tabela).getAllByRole('columnheader').map((c) => c.textContent)).toEqual([
      'Criticidade',
      'Título',
      'Categoria',
      'Local',
      'Tempo aberto',
      'Status',
      'Responsável',
      'Ações',
    ])
    expect(within(within(tabela).getAllByRole('row')[1]).getAllByRole('cell')).toHaveLength(8)

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

    const detalhes = screen.getByRole('group', { name: 'Detalhes de #4' })
    expect(detalhes).toHaveTextContent('Carreta parada')
    expect(detalhes).toHaveTextContent('RTA4E21')
    expect(detalhes).toHaveTextContent('OrigemRegistrado na central')
  })

  it('incidente enviado por caminhão mostra a origem na linha e nos detalhes', async () => {
    const dispositivo = { id: 1, nome: 'Simulador do caminhão RTA4E21', placa: 'RTA4E21' }
    simularLista(async () => respostaJson(200, lista([incidente({ id: 4, dispositivo })])))
    renderizar()

    await userEvent.click(await screen.findByRole('button', { name: 'Ver detalhes de #4' }))

    expect(screen.getByText('Enviado por Simulador do caminhão RTA4E21')).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Detalhes de #4' })).toHaveTextContent(
      'OrigemSimulador do caminhão RTA4E21',
    )
  })

  it('mostra o esqueleto com o loader enquanto a primeira leitura não chega', () => {
    simularLista(nunca)
    renderizar()

    const linha = screen.getByText('Carregando incidentes…', { selector: 'p:not([role])' })
    expect(linha).toBeInTheDocument()
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

    expect(await screen.findByRole('table', { name: 'Incidentes' })).toBeInTheDocument()
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
    // A queda termina com um estado positivo, que some sozinho.
    expect(screen.getByText('Conexão restabelecida.')).toBeInTheDocument()
    // O leitor de tela ouve a volta por uma região fixa (a faixa visível entra já com texto).
    expect(
      screen.getByText('Conexão restabelecida. A lista está ao vivo de novo.'),
    ).toHaveAttribute('role', 'status')
    await act(() => vi.advanceTimersByTimeAsync(2_500))
    expect(screen.queryByText('Conexão restabelecida.')).not.toBeInTheDocument()
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

describe('TelaTriagem — filtros', () => {
  const frota = [
    incidente({ id: 1, titulo: 'Capotamento', criticidade: 'alta', categoria: 'acidente_vitimas' }),
    incidente({
      id: 2,
      titulo: 'Árvore na pista',
      criticidade: 'media',
      categoria: 'bloqueio_pista',
      local: 'SP-160, km 40',
    }),
    incidente({ id: 3, titulo: 'Pane elétrica', criticidade: 'baixa', placa: 'RTA4E21' }),
    incidente({ id: 12, titulo: 'Pane no freio', criticidade: 'alta', local: 'BR-381, km 9' }),
    incidente({ id: 20, titulo: 'Pneu trocado', criticidade: 'alta', status: 'fechado' }),
  ]

  async function idsVisiveis() {
    const linhas = [
      ...(await screen.findByRole('table', { name: 'Incidentes' })).querySelectorAll<HTMLElement>(
        '[data-incidente]',
      ),
    ]
    return linhas.map((l) => within(l).getByText(/^#\d+$/).textContent)
  }

  // A linha visível e a região viva escondida (o indicador de conexão também é um status).
  const linhaDeStatus = () => document.querySelector('p.text-texto-2:not([role])')
  // A região viva escondida da linha de status (o indicador de conexão também é um status).
  const anuncio = () => document.querySelector('p[role="status"].sr-only')

  function abrirCom(url = '/') {
    window.history.replaceState(null, '', url)
    simularLista(async () => respostaJson(200, lista(frota)))
    renderizar()
  }

  it('o cartão de criticidade filtra a lista e grava o filtro na URL', async () => {
    abrirCom()

    const alta = await screen.findByRole('button', { name: /^Alta: 2 ativos/ })
    await userEvent.click(alta)

    expect(alta).toHaveAttribute('aria-pressed', 'true')
    expect(await idsVisiveis()).toEqual(['#1', '#12'])
    // O Alta fechado não aparece em "Ativos"; a linha de estado diz onde ele está.
    expect(linhaDeStatus()?.textContent).toBe(
      'Mostrando 2 de 4 incidentes ativos (filtrado) · 1 fechado em "Fechados"',
    )
    await waitFor(() => expect(window.location.search).toBe('?criticidade=alta'))
  })

  it('"Fechados" e "Todos" trazem os fechados; a escolha vai para a URL', async () => {
    abrirCom()
    const situacao = await screen.findByRole('group', { name: 'Situação' })
    await userEvent.click(await within(situacao).findByRole('button', { name: 'Fechados, 1 fechado' }))

    expect(await idsVisiveis()).toEqual(['#20'])
    expect(linhaDeStatus()?.textContent).toBe('Mostrando 1 de 1 incidente fechado (filtrado)')
    await waitFor(() => expect(window.location.search).toBe('?situacao=fechados'))

    await userEvent.click(within(situacao).getByRole('button', { name: 'Todos, 5 incidentes' }))
    expect(await idsVisiveis()).toEqual(['#1', '#2', '#3', '#12', '#20'])
    expect(linhaDeStatus()?.textContent).toBe(
      'Mostrando 5 de 5 incidentes (filtrado) · 1 fechado no fim da lista',
    )

    // "Limpar filtros" volta para "Ativos".
    await userEvent.click(screen.getByRole('button', { name: 'Limpar filtros' }))
    expect(await idsVisiveis()).toEqual(['#1', '#2', '#3', '#12'])
  })

  it('"Atribuídos a mim" mostra só os incidentes assumidos pelo analista', async () => {
    window.history.replaceState(null, '', '/')
    simularLista(async () =>
      respostaJson(
        200,
        lista([
          incidente({ id: 1, status: 'em_investigacao', responsavel: ANA }),
          incidente({ id: 2, status: 'em_investigacao', responsavel: BRUNO }),
          incidente({ id: 3 }),
          incidente({ id: 4, status: 'fechado', responsavel: ANA }),
        ]),
      ),
    )
    renderizar()

    const fila = await screen.findByRole('button', { name: 'Atribuídos a mim, 1 ativo' })
    await userEvent.click(fila)

    expect(fila).toHaveAttribute('aria-pressed', 'true')
    expect(await idsVisiveis()).toEqual(['#1'])
    await waitFor(() => expect(window.location.search).toBe('?responsavel=eu'))
  })

  it('↑ e ↓ na seta de detalhes passam para a linha de cima ou de baixo', async () => {
    abrirCom()
    const primeira = await screen.findByRole('button', { name: 'Ver detalhes de #1' })
    primeira.focus()

    await userEvent.keyboard('{ArrowDown}')
    expect(screen.getByRole('button', { name: 'Ver detalhes de #2' })).toHaveFocus()
    await userEvent.keyboard('{ArrowUp}')
    expect(primeira).toHaveFocus()
    // Na primeira linha, ↑ não sai da tabela.
    await userEvent.keyboard('{ArrowUp}')
    expect(primeira).toHaveFocus()
  })

  it('recarregar a página mantém os filtros da URL', async () => {
    abrirCom('/?categoria=bloqueio_pista')

    expect(await idsVisiveis()).toEqual(['#2'])
    expect(screen.getByRole('button', { name: /^Bloqueio de Pista/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  it('o botão Voltar do navegador troca os filtros da tela', async () => {
    abrirCom('/?criticidade=baixa')
    expect(await idsVisiveis()).toEqual(['#3'])

    act(() => {
      window.history.replaceState(null, '', '/?criticidade=media')
      window.dispatchEvent(new PopStateEvent('popstate'))
    })

    expect(await idsVisiveis()).toEqual(['#2'])
  })

  it('as contagens de cada filtro respeitam os outros filtros', async () => {
    abrirCom('/?criticidade=alta&categoria=acidente_vitimas')

    expect(
      await screen.findByRole('button', { name: 'Acidente com Vítimas, 1 ativo' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Problema Mecânico, 1 ativo' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Bloqueio de Pista, 0 ativos' })).toBeInTheDocument()
    // O cartão ALTA conta só a categoria escolhida (o #12 é de outra categoria).
    expect(screen.getByRole('button', { name: /^Alta: 1 ativo\./ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Baixa: Nenhum ativo' })).toBeInTheDocument()
  })

  it('busca por título, local, placa e número', async () => {
    abrirCom()
    const busca = await screen.findByRole('searchbox', { name: 'Buscar incidente' })

    await userEvent.type(busca, 'arvore')
    expect(await idsVisiveis()).toEqual(['#2'])

    await userEvent.clear(busca)
    await userEvent.type(busca, 'br381')
    expect(await idsVisiveis()).toEqual(['#12'])

    await userEvent.clear(busca)
    await userEvent.type(busca, 'rta 4e21')
    expect(await idsVisiveis()).toEqual(['#3'])

    // "#1" é só o incidente 1, não o 12.
    await userEvent.clear(busca)
    await userEvent.type(busca, '#1')
    expect(await idsVisiveis()).toEqual(['#1'])
    await waitFor(() => expect(window.location.search).toBe('?busca=%231'))

    await userEvent.keyboard('{Escape}')
    expect(busca).toHaveValue('')
    expect(await idsVisiveis()).toEqual(['#1', '#2', '#3', '#12'])
  })

  it('anuncia a contagem ao leitor de tela só quando a digitação para', async () => {
    abrirCom()
    const busca = await screen.findByRole('searchbox', { name: 'Buscar incidente' })
    await waitFor(() => expect(anuncio()).toHaveTextContent('Mostrando 4 de 4'))

    await userEvent.type(busca, 'pane')

    expect(linhaDeStatus()).toHaveTextContent('Mostrando 2 de 4 incidentes ativos (filtrado)')
    expect(anuncio()).toHaveTextContent('Mostrando 4 de 4')
    await waitFor(() =>
      expect(anuncio()).toHaveTextContent('Mostrando 2 de 4 incidentes ativos (filtrado)'),
    )
  })

  it('Ctrl+K e "/" levam o foco à busca; Ctrl+/ não', async () => {
    abrirCom()
    await idsVisiveis()
    const busca = screen.getByRole('searchbox', { name: 'Buscar incidente' })

    await userEvent.keyboard('{Control>}k{/Control}')
    expect(busca).toHaveFocus()

    busca.blur()
    await userEvent.keyboard('{Control>}/{/Control}')
    expect(busca).not.toHaveFocus()

    await userEvent.keyboard('/')
    expect(busca).toHaveFocus()
    // Dentro de um campo, "/" é texto, não atalho.
    expect(busca).toHaveValue('')
    await userEvent.keyboard('/')
    expect(busca).toHaveValue('/')
  })

  it('mostra o estado vazio do filtro e limpa tudo, com o foco na busca', async () => {
    abrirCom('/?criticidade=baixa&categoria=bloqueio_pista')

    const titulo = await screen.findByRole('heading', {
      name: 'Nenhum incidente com estes filtros',
    })
    const painel = titulo.parentElement!
    expect(painel).toHaveTextContent(
      'Filtro atual: Criticidade Baixa · Bloqueio de Pista. ' +
        'Há 4 incidentes ativos fora deste filtro.',
    )

    await userEvent.click(within(painel).getByRole('button', { name: 'Limpar filtros' }))

    expect(await idsVisiveis()).toEqual(['#1', '#2', '#3', '#12'])
    expect(screen.queryByRole('button', { name: 'Limpar filtros' })).not.toBeInTheDocument()
    expect(screen.getByRole('searchbox', { name: 'Buscar incidente' })).toHaveFocus()
    await waitFor(() => expect(window.location.search).toBe(''))
  })

  it('busca só com hífen não conta como filtro', async () => {
    abrirCom()
    await idsVisiveis()
    fireEvent.change(screen.getByRole('searchbox', { name: 'Buscar incidente' }), {
      target: { value: '-' },
    })

    expect(screen.queryByRole('button', { name: 'Limpar filtros' })).not.toBeInTheDocument()
    expect(linhaDeStatus()?.textContent).toBe('Mostrando 4 de 4 incidentes ativos')
  })
})

describe('TelaTriagem — guia', () => {
  afterEach(() => localStorage.clear())

  it('a dica de primeiro acesso abre o guia e não volta depois de vista', async () => {
    localStorage.clear()
    simularLista(async () => respostaJson(200, lista([incidente({ id: 1 })])))
    const { unmount } = renderizar()

    await userEvent.click(await screen.findByRole('button', { name: 'Ver guia' }))
    const guia = await screen.findByRole('dialog', { name: 'Como funciona a triagem' })
    expect(within(guia).getByText(/Só o responsável muda o status/)).toBeInTheDocument()

    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    // A dica sumiu com a abertura; o foco vai para o botão de ajuda do cabeçalho.
    expect(screen.getByRole('button', { name: 'Como funciona a triagem' })).toHaveFocus()
    expect(screen.queryByRole('button', { name: 'Ver guia' })).toBeNull()

    unmount()
    renderizar()
    await screen.findByRole('button', { name: 'Como funciona a triagem' })
    expect(screen.queryByRole('button', { name: 'Ver guia' })).toBeNull()
  })

  it('o botão de ajuda do cabeçalho abre o guia', async () => {
    localStorage.setItem('logos.guia-visto', '1')
    simularLista(async () => respostaJson(200, lista([incidente({ id: 1 })])))
    renderizar()

    expect(screen.queryByRole('button', { name: 'Ver guia' })).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'Como funciona a triagem' }))
    expect(await screen.findByRole('dialog', { name: 'Como funciona a triagem' })).toBeVisible()
  })

  it('dispensar a dica leva o foco ao botão de ajuda', async () => {
    localStorage.clear()
    simularLista(async () => respostaJson(200, lista([incidente({ id: 1 })])))
    renderizar()

    await userEvent.click(await screen.findByRole('button', { name: 'Dispensar a dica' }))
    expect(screen.getByRole('button', { name: 'Como funciona a triagem' })).toHaveFocus()
  })
})

