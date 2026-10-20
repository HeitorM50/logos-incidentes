import { QueryClientProvider } from '@tanstack/react-query'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Incidente } from '@/api/tipos'
import { criarClienteDeConsultas } from '@/lib/consultas'
import { ANA, BRUNO, erroDaApi, incidente, lista, respostaJson } from '@/test/fabricas'
import { TelaTriagem } from './TelaTriagem'
import { CHAVE_INCIDENTES } from './useIncidentes'

// Servidor falso: GET /incidentes devolve `servidor.itens`; cada POST passa por `responder`,
// que o teste troca para simular sucesso, falha ou conflito.

interface Chamada {
  url: string
  corpo: unknown
}

function simularServidor(itens: Incidente[]) {
  const servidor = {
    itens,
    chamadas: [] as Chamada[],
    /** Leituras novas nunca respondem: prova que a tela mudou sem reler a lista. */
    leiturasCongeladas: false,
    responder: (_chamada: Chamada): Promise<Response> => new Promise(() => {}),
  }
  vi.stubGlobal(
    'fetch',
    vi.fn(async (entrada: RequestInfo | URL, init?: RequestInit) => {
      const url = String(entrada)
      if (!init?.method || init.method === 'GET') {
        if (servidor.leiturasCongeladas) return new Promise<Response>(() => {})
        return respostaJson(200, lista(servidor.itens))
      }
      const chamada = { url, corpo: init.body ? JSON.parse(String(init.body)) : null }
      servidor.chamadas.push(chamada)
      return servidor.responder(chamada)
    }),
  )
  return servidor
}

function renderizar() {
  const cliente = criarClienteDeConsultas()
  cliente.setDefaultOptions({ queries: { retry: false } })
  render(
    <QueryClientProvider client={cliente}>
      <TelaTriagem analista={ANA} aoSair={() => {}} />
    </QueryClientProvider>,
  )
  return cliente
}

async function linhaDe(id: number) {
  const linhas = [
    ...(await screen.findByRole('table', { name: 'Incidentes' })).querySelectorAll<HTMLElement>(
      '[data-incidente]',
    ),
  ]
  return linhas.find((l) => within(l).queryByText(`#${id}`)) ?? null
}

/** A região viva das ações (a linha de estado da lista também é um status escondido). */
const anuncio = () => document.querySelectorAll('p[role="status"].sr-only')[1]

const naoResponde = () => new Promise<Response>(() => {})

afterEach(() => {
  vi.unstubAllGlobals()
  window.history.replaceState(null, '', '/')
})

describe('TelaTriagem — ações', () => {
  it('assumir muda a linha na hora e grava a versão que a API devolve', async () => {
    const livre = incidente({ id: 7, versao: 3 })
    const servidor = simularServidor([livre])
    let confirmar!: (r: Response) => void
    servidor.responder = () => new Promise((r) => (confirmar = r))
    renderizar()
    const assumir = await screen.findByRole('button', { name: 'Assumir #7' })
    servidor.leiturasCongeladas = true

    await userEvent.click(assumir)

    // Otimista: antes da resposta, a linha já mostra "Você" e o andamento.
    const linha = (await linhaDe(7))!
    expect(within(linha).getByText('Você')).toBeInTheDocument()
    expect(within(linha).getByText('Assumindo…')).toBeInTheDocument()
    expect(anuncio()).toHaveTextContent('Assumindo #7…')
    expect(servidor.chamadas).toEqual([
      { url: expect.stringMatching(/\/incidentes\/7\/assumir$/), corpo: { versao: 3 } },
    ])

    // Sem nova leitura: a linha passa a mostrar a versão da própria resposta.
    await act(async () =>
      confirmar(
        respostaJson(200, { ...livre, versao: 4, status: 'em_investigacao', responsavel: ANA }),
      ),
    )

    expect(await screen.findByRole('button', { name: 'Liberar #7' })).not.toHaveAttribute(
      'aria-disabled',
    )
    expect(within((await linhaDe(7))!).getByText('Em Investigação')).toBeInTheDocument()
    expect(anuncio()).toHaveTextContent('Você assumiu #7.')
  })

  it('a leitura periódica não apaga a mudança em andamento', async () => {
    simularServidor([incidente({ id: 7 })])
    const cliente = renderizar()

    await userEvent.click(await screen.findByRole('button', { name: 'Assumir #7' }))
    // O servidor ainda devolve o incidente sem responsável.
    await act(() => cliente.refetchQueries({ queryKey: CHAVE_INCIDENTES }))

    expect(within((await linhaDe(7))!).getByText('Você')).toBeInTheDocument()
  })

  it('desfaz a mudança e avisa quando a API falha', async () => {
    const servidor = simularServidor([incidente({ id: 7 })])
    servidor.responder = async () => erroDaApi(503, 'servico_indisponivel')
    renderizar()
    const assumir = await screen.findByRole('button', { name: 'Assumir #7' })
    servidor.leiturasCongeladas = true

    await userEvent.click(assumir)

    const aviso = await screen.findByRole('alert')
    expect(aviso).toHaveTextContent('Não foi possível assumir #7. A ação foi desfeita.')
    expect(aviso).toHaveTextContent(
      'O incidente voltou ao estado anterior (Aberto, sem responsável).',
    )
    expect(within((await linhaDe(7))!).getByText('Sem responsável')).toBeInTheDocument()

    // "Tentar de novo" repete a mesma ação.
    servidor.responder = naoResponde
    await userEvent.click(within(aviso).getByRole('button', { name: 'Tentar de novo' }))
    expect(servidor.chamadas).toHaveLength(2)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('a falha de uma linha não desfaz a outra, e cada falha tem seu aviso', async () => {
    const servidor = simularServidor([
      incidente({ id: 7 }),
      incidente({ id: 9 }),
      incidente({ id: 11 }),
    ])
    servidor.responder = async ({ url }) =>
      url.includes('/11/') ? naoResponde() : erroDaApi(503, 'servico_indisponivel')
    renderizar()
    await screen.findByRole('button', { name: 'Assumir #7' })
    servidor.leiturasCongeladas = true

    await userEvent.click(screen.getByRole('button', { name: 'Assumir #11' }))
    await userEvent.click(screen.getByRole('button', { name: 'Assumir #7' }))
    await userEvent.click(screen.getByRole('button', { name: 'Assumir #9' }))

    await waitFor(() => expect(screen.getAllByRole('alert')).toHaveLength(2))
    expect(within((await linhaDe(11))!).getByText('Você')).toBeInTheDocument()
    expect(within((await linhaDe(7))!).getByText('Sem responsável')).toBeInTheDocument()
  })

  it('o aviso some quando a lista mostra uma versão mais nova do incidente', async () => {
    const servidor = simularServidor([incidente({ id: 7, versao: 1 })])
    servidor.responder = async () => erroDaApi(503, 'servico_indisponivel')
    const cliente = renderizar()

    await userEvent.click(await screen.findByRole('button', { name: 'Assumir #7' }))
    await screen.findByRole('alert')

    // Enquanto isso, o Bruno assumiu: "Tentar de novo" não faria mais sentido.
    servidor.itens = [
      incidente({ id: 7, versao: 2, responsavel: BRUNO, status: 'em_investigacao' }),
    ]
    await act(() => cliente.refetchQueries({ queryKey: CHAVE_INCIDENTES }))

    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument())
  })

  it('no 409 mostra quem alterou e a versão atual', async () => {
    const servidor = simularServidor([incidente({ id: 7, versao: 1 })])
    const doBruno = incidente({
      id: 7,
      versao: 2,
      status: 'em_investigacao',
      responsavel: BRUNO,
      atualizado_por: BRUNO,
    })
    servidor.responder = async () => erroDaApi(409, 'ja_assumido', { atual: doBruno })
    renderizar()
    const assumir = await screen.findByRole('button', { name: 'Assumir #7' })
    // A linha deve mostrar o Bruno a partir do próprio 409, sem esperar a próxima leitura.
    servidor.leiturasCongeladas = true

    await userEvent.click(assumir)

    const linha = (await linhaDe(7))!
    expect(await within(linha).findByText('Bruno Lima alterou este incidente')).toBeInTheDocument()
    expect(linha).toHaveTextContent('Agora está Em Investigação, com Bruno Lima.')
    expect(linha).toHaveTextContent('Sua ação “Assumir” não foi aplicada')
    // Refazer não faz sentido: o incidente agora é do Bruno.
    expect(within(linha).queryByRole('button', { name: 'Refazer minha ação' })).toBeNull()
    expect(linha).toHaveTextContent('Não dá para refazer: Bruno Lima é o responsável')
    expect(anuncio()).toHaveTextContent('#7: Bruno Lima alterou este incidente antes.')

    await userEvent.click(within(linha).getByRole('button', { name: 'Manter versão atual' }))
    expect(within((await linhaDe(7))!).queryByText(/alterou este incidente/)).toBeNull()
  })

  it('"Refazer minha ação" repete com a versão atual', async () => {
    const servidor = simularServidor([incidente({ id: 7, versao: 1 })])
    // Outro analista só editou o título: assumir continua possível.
    const editado = incidente({ id: 7, versao: 2, titulo: 'Título novo', atualizado_por: BRUNO })
    servidor.responder = async () => {
      servidor.itens = [editado]
      return erroDaApi(409, 'conflito_versao', { atual: editado })
    }
    renderizar()

    await userEvent.click(await screen.findByRole('button', { name: 'Assumir #7' }))
    const refazer = await screen.findByRole('button', { name: 'Refazer minha ação' })

    servidor.responder = naoResponde
    await userEvent.click(refazer)

    expect(servidor.chamadas.at(-1)?.corpo).toEqual({ versao: 2 })
  })

  it('no 404 tira a linha da lista e explica', async () => {
    const servidor = simularServidor([incidente({ id: 7 }), incidente({ id: 8 })])
    servidor.responder = async () => erroDaApi(404, 'nao_encontrado')
    renderizar()
    const assumir = await screen.findByRole('button', { name: 'Assumir #7' })
    servidor.leiturasCongeladas = true

    await userEvent.click(assumir)

    expect(await screen.findByRole('alert')).toHaveTextContent('O incidente #7 não existe mais.')
    expect(await linhaDe(7)).toBeNull()
  })

  it('erro 500 não promete que nada mudou nem oferece repetir', async () => {
    const servidor = simularServidor([incidente({ id: 7 })])
    servidor.responder = async () => erroDaApi(500, 'erro_interno')
    renderizar()

    await userEvent.click(await screen.findByRole('button', { name: 'Assumir #7' }))

    const aviso = await screen.findByRole('alert')
    expect(aviso).toHaveTextContent('Erro inesperado ao assumir #7.')
    expect(aviso).toHaveTextContent('Confira a linha antes de tentar de novo.')
    expect(within(aviso).queryByRole('button', { name: 'Tentar de novo' })).toBeNull()
  })

  it('ignora o segundo clique enquanto a ação está em andamento', async () => {
    const servidor = simularServidor([incidente({ id: 7 })])
    renderizar()
    const botao = await screen.findByRole('button', { name: 'Assumir #7' })

    // Os dois cliques no mesmo ciclo do React: só a guarda imediata segura o segundo.
    act(() => {
      botao.click()
      botao.click()
    })

    await waitFor(() => expect(servidor.chamadas).toHaveLength(1))
  })

  it('mostra a ação bloqueada com o motivo e não chama a API', async () => {
    const servidor = simularServidor([
      incidente({ id: 3, status: 'em_investigacao', responsavel: BRUNO }),
    ])
    renderizar()

    const assumir = await screen.findByRole('button', { name: 'Assumir #3' })
    expect(assumir).toHaveAttribute('aria-disabled', 'true')
    expect(assumir).toHaveAccessibleDescription('Bruno Lima é o responsável por este incidente.')
    expect(screen.getByRole('button', { name: 'Mudar status de #3' })).toHaveAccessibleDescription(
      'Só Bruno Lima pode mudar o status.',
    )

    // No toque não há hover: o clique mostra o motivo; Esc esconde.
    await userEvent.click(assumir)
    expect(screen.getByRole('tooltip')).toHaveTextContent('Bruno Lima é o responsável')
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
    expect(servidor.chamadas).toHaveLength(0)
  })

  it('o responsável muda o status pelo menu; a seta do teclado não dispara nada', async () => {
    const servidor = simularServidor([
      incidente({ id: 5, versao: 8, status: 'em_investigacao', responsavel: ANA }),
    ])
    renderizar()

    const gatilho = await screen.findByRole('button', { name: 'Mudar status de #5' })
    gatilho.focus()
    await userEvent.keyboard('{ArrowDown}')
    const menu = await screen.findByRole('menu')
    expect(within(menu).getAllByRole('menuitem').map((o) => o.textContent)).toEqual([
      'Inconclusivo',
      'Fechado',
    ])
    await userEvent.keyboard('{ArrowDown}')
    expect(servidor.chamadas).toHaveLength(0)

    await userEvent.click(within(menu).getByRole('menuitem', { name: 'Inconclusivo' }))

    expect(servidor.chamadas).toEqual([
      {
        url: expect.stringMatching(/\/incidentes\/5\/status$/),
        corpo: { versao: 8, status: 'inconclusivo' },
      },
    ])
    expect(within((await linhaDe(5))!).getByText('Salvando status…')).toBeInTheDocument()
    // O menu sai da tela durante a ação; o foco vai para o botão principal, não para o topo.
    await waitFor(() => expect(screen.getByRole('button', { name: 'Liberar #5' })).toHaveFocus())
  })

  it('fechar pede confirmação antes de chamar a API', async () => {
    const servidor = simularServidor([
      incidente({ id: 5, versao: 8, status: 'inconclusivo', responsavel: ANA }),
    ])
    renderizar()

    await userEvent.click(await screen.findByRole('button', { name: 'Mudar status de #5' }))
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Fechado' }))
    const dialogo = await screen.findByRole('alertdialog', { name: 'Fechar o incidente #5?' })
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Cancelar' }))
    expect(servidor.chamadas).toHaveLength(0)

    await userEvent.click(screen.getByRole('button', { name: 'Mudar status de #5' }))
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Fechado' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Fechar incidente' }))

    expect(servidor.chamadas.map((c) => c.corpo)).toEqual([{ versao: 8, status: 'fechado' }])
  })

  it('fechar um Alta e a ação falhar não gera aviso de "Alta novo"', async () => {
    // O aviso observa só a lista confirmada: a linha sair e voltar pelo rollback não é novidade.
    const servidor = simularServidor([
      incidente({
        id: 7,
        criticidade: 'alta',
        status: 'em_investigacao',
        responsavel: ANA,
        atualizado_por: BRUNO,
      }),
    ])
    servidor.responder = async () => erroDaApi(503, 'servico_indisponivel')
    const cliente = renderizar()

    await userEvent.click(await screen.findByRole('button', { name: 'Mudar status de #7' }))
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Fechado' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Fechar incidente' }))

    expect(await screen.findByText(/Não foi possível mudar o status de #7/)).toBeInTheDocument()
    await cliente.refetchQueries()
    expect(screen.queryByText('Novo incidente Alta')).toBeNull()
    expect(within((await linhaDe(7))!).queryByText('Novo')).toBeNull()
  })
})
