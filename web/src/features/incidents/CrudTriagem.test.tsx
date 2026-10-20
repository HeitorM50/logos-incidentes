import { QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Incidente } from '@/api/tipos'
import { criarClienteDeConsultas } from '@/lib/consultas'
import { ANA, BRUNO, erroDaApi, incidente, lista, respostaJson } from '@/test/fabricas'
import { TelaTriagem } from './TelaTriagem'

// Servidor falso: GET devolve `servidor.itens`; POST, PATCH e DELETE passam por `responder`.

interface Chamada {
  metodo: string
  url: string
  corpo: unknown
}

function simularServidor(itens: Incidente[]) {
  const servidor = {
    itens,
    chamadas: [] as Chamada[],
    eventos: [] as unknown[],
    responder: (_chamada: Chamada): Promise<Response> => new Promise(() => {}),
  }
  vi.stubGlobal(
    'fetch',
    vi.fn(async (entrada: RequestInfo | URL, init?: RequestInit) => {
      const url = String(entrada)
      const metodo = init?.method ?? 'GET'
      if (url.includes('/eventos')) return respostaJson(200, servidor.eventos)
      if (metodo === 'GET') return respostaJson(200, lista(servidor.itens))
      const chamada = { metodo, url, corpo: init?.body ? JSON.parse(String(init.body)) : null }
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

async function abrirDetalhes(id: number) {
  await userEvent.click(await screen.findByRole('button', { name: `Ver detalhes de #${id}` }))
}

/** Região viva das confirmações de criar, editar e remover. */
const anuncioSucesso = () => document.querySelectorAll('p[role="status"].sr-only')[2]

afterEach(() => {
  vi.unstubAllGlobals()
  window.history.replaceState(null, '', '/')
})

describe('TelaTriagem — criar', () => {
  it('dado inválido não chega à API: o erro aparece no campo e o foco vai para ele', async () => {
    const servidor = simularServidor([incidente({ id: 1 })])
    renderizar()
    await userEvent.click(await screen.findByRole('button', { name: 'Novo incidente' }))
    const painel = await screen.findByRole('dialog', { name: 'Novo incidente' })

    await userEvent.type(within(painel).getByLabelText(/Título/), 'ab')
    await userEvent.type(within(painel).getByLabelText(/Placa/), 'XYZ')
    await userEvent.click(within(painel).getByRole('button', { name: 'Criar incidente' }))

    expect(servidor.chamadas).toEqual([])
    const titulo = within(painel).getByLabelText(/Título/)
    expect(titulo).toHaveAttribute('aria-invalid', 'true')
    expect(titulo).toHaveAccessibleDescription('Use pelo menos 3 caracteres.')
    await waitFor(() => expect(titulo).toHaveFocus())
    expect(within(painel).getByLabelText(/Placa/)).toHaveAccessibleDescription(
      /Placa inválida/,
    )
    expect(within(painel).getByText('Escolha a categoria.')).toBeInTheDocument()
    expect(within(painel).getByText('Escolha a criticidade.')).toBeInTheDocument()

    // Corrigido o campo, o erro some sem precisar enviar de novo.
    await userEvent.type(titulo, 'c')
    expect(titulo).not.toHaveAttribute('aria-invalid')
  })

  it('envia o corpo normalizado, fecha o painel e confirma', async () => {
    const servidor = simularServidor([incidente({ id: 1 })])
    const criado = incidente({ id: 101, titulo: 'Tombamento na serra', criticidade: 'alta' })
    servidor.responder = async () => {
      servidor.itens = [...servidor.itens, criado]
      return respostaJson(201, criado)
    }
    renderizar()
    await userEvent.click(await screen.findByRole('button', { name: 'Novo incidente' }))
    const painel = await screen.findByRole('dialog', { name: 'Novo incidente' })

    await userEvent.type(within(painel).getByLabelText(/Título/), '  Tombamento na serra ')
    await userEvent.selectOptions(within(painel).getByLabelText(/Categoria/), 'acidente_veiculo')
    await userEvent.click(within(painel).getByRole('radio', { name: 'Alta' }))
    await userEvent.type(within(painel).getByLabelText(/Local/), 'BR-376, km 668')
    await userEvent.type(within(painel).getByLabelText(/Placa/), 'abc-1d23')
    await userEvent.click(within(painel).getByRole('button', { name: 'Criar incidente' }))

    expect(servidor.chamadas).toEqual([
      {
        metodo: 'POST',
        url: expect.stringMatching(/\/incidentes$/),
        corpo: {
          titulo: 'Tombamento na serra',
          descricao: null,
          categoria: 'acidente_veiculo',
          criticidade: 'alta',
          local: 'BR-376, km 668',
          placa: 'ABC1D23',
        },
      },
    ])
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(anuncioSucesso()).toHaveTextContent('Incidente #101 criado.')

    // "Mostrar na lista" filtra pelo número do incidente novo.
    await userEvent.click(screen.getByRole('button', { name: 'Mostrar na lista' }))
    expect(screen.getByRole('searchbox', { name: 'Buscar incidente' })).toHaveValue('#101')
    expect(await screen.findByText('Tombamento na serra')).toBeInTheDocument()
  })

  it('o 422 da API aparece no campo, e os dados continuam no formulário', async () => {
    const servidor = simularServidor([])
    servidor.responder = async () =>
      erroDaApi(422, 'validacao', {
        mensagem: 'Dados inválidos.',
        campos: [{ campo: 'local', mensagem: 'local muito curto' }],
      })
    renderizar()
    await userEvent.click(await screen.findByRole('button', { name: 'Novo incidente' }))
    const painel = await screen.findByRole('dialog', { name: 'Novo incidente' })
    await userEvent.type(within(painel).getByLabelText(/Título/), 'Pane elétrica')
    await userEvent.selectOptions(within(painel).getByLabelText(/Categoria/), 'problema_mecanico')
    await userEvent.click(within(painel).getByRole('radio', { name: 'Baixa' }))
    await userEvent.type(within(painel).getByLabelText(/Local/), 'Pátio')
    await userEvent.click(within(painel).getByRole('button', { name: 'Criar incidente' }))

    const local = within(painel).getByLabelText(/Local/)
    await waitFor(() => expect(local).toHaveAccessibleDescription('local muito curto'))
    await waitFor(() => expect(local).toHaveFocus())
    expect(within(painel).getByLabelText(/Título/)).toHaveValue('Pane elétrica')
  })
})

describe('TelaTriagem — Salvo', () => {
  it('Esc durante o "✓ Salvo" fecha sem perguntar e não perde a confirmação', async () => {
    const servidor = simularServidor([])
    const criado = incidente({ id: 101, titulo: 'Pane elétrica' })
    servidor.responder = async () => respostaJson(201, criado)
    renderizar()
    await userEvent.click(await screen.findByRole('button', { name: 'Novo incidente' }))
    const painel = await screen.findByRole('dialog', { name: 'Novo incidente' })
    await userEvent.type(within(painel).getByLabelText(/Título/), 'Pane elétrica')
    await userEvent.selectOptions(within(painel).getByLabelText(/Categoria/), 'problema_mecanico')
    await userEvent.click(within(painel).getByRole('radio', { name: 'Baixa' }))
    await userEvent.type(within(painel).getByLabelText(/Local/), 'Pátio')
    await userEvent.click(within(painel).getByRole('button', { name: 'Criar incidente' }))
    await within(painel).findByText('Salvo')

    await userEvent.keyboard('{Escape}')

    expect(screen.queryByText('Descartar o que você digitou?')).toBeNull()
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(anuncioSucesso()).toHaveTextContent('Incidente #101 criado.')
  })
})

describe('TelaTriagem — editar', () => {
  it('envia só o campo alterado com a versão lida', async () => {
    const original = incidente({ id: 7, versao: 4, titulo: 'Pneu estourado' })
    const servidor = simularServidor([original])
    servidor.responder = async () => {
      const novo = { ...original, titulo: 'Pneu estourado no eixo 2', versao: 5 }
      servidor.itens = [novo]
      return respostaJson(200, novo)
    }
    renderizar()
    await abrirDetalhes(7)
    await userEvent.click(screen.getByRole('button', { name: 'Editar #7' }))
    const painel = await screen.findByRole('dialog', { name: 'Editar incidente #7' })
    const titulo = within(painel).getByLabelText(/Título/)
    expect(titulo).toHaveValue('Pneu estourado')

    await userEvent.type(titulo, ' no eixo 2')
    await userEvent.click(within(painel).getByRole('button', { name: 'Salvar alterações' }))

    expect(servidor.chamadas).toEqual([
      {
        metodo: 'PATCH',
        url: expect.stringMatching(/\/incidentes\/7$/),
        corpo: { titulo: 'Pneu estourado no eixo 2', versao: 4 },
      },
    ])
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(anuncioSucesso()).toHaveTextContent('Incidente #7 salvo.')
    expect(await screen.findByText('Pneu estourado no eixo 2')).toBeInTheDocument()
    // O foco volta ao botão que abriu o painel.
    await waitFor(() => expect(screen.getByRole('button', { name: 'Editar #7' })).toHaveFocus())
  })

  it('sem mudança, não chama a API', async () => {
    const servidor = simularServidor([incidente({ id: 7 })])
    renderizar()
    await abrirDetalhes(7)
    await userEvent.click(screen.getByRole('button', { name: 'Editar #7' }))
    const painel = await screen.findByRole('dialog', { name: 'Editar incidente #7' })
    await userEvent.click(within(painel).getByRole('button', { name: 'Salvar alterações' }))

    expect(servidor.chamadas).toEqual([])
    expect(await within(painel).findByRole('alert')).toHaveTextContent('Nada mudou.')
  })

  it('409: mostra o que o outro analista mudou e mescla as mudanças', async () => {
    const original = incidente({ id: 7, versao: 4, titulo: 'Pneu estourado', local: 'Km 10' })
    const deBruno = { ...original, versao: 5, local: 'Km 12', atualizado_por: BRUNO }
    const servidor = simularServidor([original])
    servidor.responder = async () => {
      servidor.itens = [deBruno]
      return erroDaApi(409, 'conflito_versao', { atual: deBruno })
    }
    renderizar()
    await abrirDetalhes(7)
    await userEvent.click(screen.getByRole('button', { name: 'Editar #7' }))
    const painel = await screen.findByRole('dialog', { name: 'Editar incidente #7' })
    await userEvent.type(within(painel).getByLabelText(/Título/), ' traseiro')
    await userEvent.click(within(painel).getByRole('button', { name: 'Salvar alterações' }))

    expect(await within(painel).findByRole('alert')).toHaveTextContent('Não foi salvo')
    expect(
      within(painel).getByText('Bruno Lima alterou este incidente depois que você abriu o painel'),
    ).toBeInTheDocument()
    expect(within(painel).getByText(/Campos alterados: Local\./)).toBeInTheDocument()
    // Salvar fica bloqueado até o analista escolher, e o clique não chama a API.
    const salvar = within(painel).getByRole('button', { name: 'Salvar alterações' })
    expect(salvar).toHaveAttribute('aria-disabled', 'true')
    await userEvent.click(salvar)
    expect(servidor.chamadas).toHaveLength(1)

    await userEvent.click(within(painel).getByRole('button', { name: 'Manter minhas mudanças' }))
    expect(within(painel).getByLabelText(/Título/)).toHaveValue('Pneu estourado traseiro')
    expect(within(painel).getByLabelText(/Local/)).toHaveValue('Km 12')

    servidor.responder = async () => respostaJson(200, { ...deBruno, versao: 6 })
    await userEvent.click(within(painel).getByRole('button', { name: 'Salvar alterações' }))
    expect(servidor.chamadas.at(-1)?.corpo).toEqual({
      titulo: 'Pneu estourado traseiro',
      versao: 5,
    })
  })

  it('409 só de status: a base avança e o segundo envio leva a versão nova', async () => {
    const original = incidente({ id: 7, versao: 4, titulo: 'Pneu estourado' })
    const inconclusivo = { ...original, versao: 5, status: 'inconclusivo' as const }
    const servidor = simularServidor([original])
    servidor.responder = async () => {
      servidor.itens = [inconclusivo]
      return erroDaApi(409, 'conflito_versao', { atual: inconclusivo })
    }
    renderizar()
    await abrirDetalhes(7)
    await userEvent.click(screen.getByRole('button', { name: 'Editar #7' }))
    const painel = await screen.findByRole('dialog', { name: 'Editar incidente #7' })
    await userEvent.type(within(painel).getByLabelText(/Título/), '!')
    await userEvent.click(within(painel).getByRole('button', { name: 'Salvar alterações' }))

    expect(await within(painel).findByRole('alert')).toHaveTextContent(
      'o status ou o responsável mudou antes',
    )
    servidor.responder = async () => respostaJson(200, { ...inconclusivo, versao: 6 })
    await userEvent.click(within(painel).getByRole('button', { name: 'Salvar alterações' }))
    expect(servidor.chamadas.at(-1)?.corpo).toEqual({ titulo: 'Pneu estourado!', versao: 5 })
  })

  it('Esc com algo digitado pede confirmação antes de descartar', async () => {
    simularServidor([])
    renderizar()
    await userEvent.click(await screen.findByRole('button', { name: 'Novo incidente' }))
    const painel = await screen.findByRole('dialog', { name: 'Novo incidente' })
    await userEvent.type(within(painel).getByLabelText(/Título/), 'Pane')

    await userEvent.keyboard('{Escape}')
    expect(within(painel).getByRole('alert')).toHaveTextContent('Descartar o que você digitou?')
    await userEvent.click(within(painel).getByRole('button', { name: 'Continuar editando' }))
    expect(within(painel).getByLabelText(/Título/)).toHaveValue('Pane')

    await userEvent.keyboard('{Escape}')
    await userEvent.click(within(painel).getByRole('button', { name: 'Descartar' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('não fecha durante o envio', async () => {
    const servidor = simularServidor([incidente({ id: 7 })])
    servidor.responder = () => new Promise(() => {})
    renderizar()
    await abrirDetalhes(7)
    await userEvent.click(screen.getByRole('button', { name: 'Editar #7' }))
    const painel = await screen.findByRole('dialog', { name: 'Editar incidente #7' })
    await userEvent.type(within(painel).getByLabelText(/Título/), '!')
    await userEvent.click(within(painel).getByRole('button', { name: 'Salvar alterações' }))
    expect(within(painel).getByText('Salvando…')).toBeInTheDocument()

    await userEvent.keyboard('{Escape}')
    await userEvent.click(within(painel).getByRole('button', { name: 'Cancelar' }))
    expect(screen.getByRole('dialog', { name: 'Editar incidente #7' })).toBeInTheDocument()
    expect(servidor.chamadas).toHaveLength(1)
  })

  it('incidente de outro responsável: Editar e Remover ficam bloqueados com o motivo', async () => {
    simularServidor([incidente({ id: 7, responsavel: BRUNO, status: 'em_investigacao' })])
    renderizar()
    await abrirDetalhes(7)
    const editar = screen.getByRole('button', { name: 'Editar #7' })
    expect(editar).toHaveAttribute('aria-disabled', 'true')
    expect(editar).toHaveAccessibleDescription(
      'Só Bruno Lima pode editar ou remover este incidente.',
    )
    await userEvent.click(editar)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Remover #7' })).toHaveAttribute(
      'aria-disabled',
      'true',
    )
  })
})

describe('TelaTriagem — remover', () => {
  it('pede confirmação, remove com a versão lida e leva o foco ao título', async () => {
    const alvo = incidente({ id: 7, versao: 3, titulo: 'Pneu estourado' })
    const servidor = simularServidor([alvo, incidente({ id: 8, titulo: 'Outro' })])
    servidor.responder = async () => {
      servidor.itens = servidor.itens.filter((i) => i.id !== 7)
      return new Response(null, { status: 204 })
    }
    renderizar()
    await abrirDetalhes(7)
    await userEvent.click(screen.getByRole('button', { name: 'Remover #7' }))
    const dialogo = await screen.findByRole('alertdialog', { name: 'Remover o incidente #7?' })
    expect(servidor.chamadas).toEqual([])

    await userEvent.click(within(dialogo).getByRole('button', { name: 'Remover incidente' }))

    expect(servidor.chamadas).toEqual([
      {
        metodo: 'DELETE',
        url: expect.stringMatching(/\/incidentes\/7\?versao=3$/),
        corpo: null,
      },
    ])
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
    await waitFor(() => expect(screen.queryByText('Pneu estourado')).not.toBeInTheDocument())
    expect(anuncioSucesso()).toHaveTextContent('Incidente #7 removido.')
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Triagem' })).toHaveFocus())
  })

  it('remove a versão que o analista viu, não a que a lista trouxe depois', async () => {
    const alvo = incidente({ id: 7, versao: 3, titulo: 'Pneu estourado' })
    const servidor = simularServidor([alvo])
    const cliente = renderizar()
    await abrirDetalhes(7)
    await userEvent.click(screen.getByRole('button', { name: 'Remover #7' }))
    const dialogo = await screen.findByRole('alertdialog')

    // Bruno muda o título enquanto a confirmação está aberta; a leitura de 5 s traz a mudança.
    const deBruno = {
      ...alvo,
      versao: 4,
      titulo: 'Pneu estourado e carga solta',
      atualizado_por: BRUNO,
    }
    servidor.itens = [deBruno]
    await cliente.refetchQueries()
    expect(await within(dialogo).findByText(/mudou desde que você abriu/)).toBeInTheDocument()

    servidor.responder = async () => erroDaApi(409, 'conflito_versao', { atual: deBruno })
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Remover incidente' }))
    expect(servidor.chamadas[0].url).toMatch(/versao=3$/)
    expect(await within(dialogo).findByRole('alert')).toHaveTextContent('confirme de novo')

    // A segunda confirmação, já com o estado novo na tela, leva a versão nova.
    servidor.responder = async () => new Response(null, { status: 204 })
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Remover incidente' }))
    expect(servidor.chamadas[1].url).toMatch(/versao=4$/)
  })

  it('409: não remove e mostra o estado atual', async () => {
    const alvo = incidente({ id: 7, versao: 3 })
    const assumido = {
      ...alvo,
      versao: 4,
      status: 'em_investigacao' as const,
      responsavel: BRUNO,
      atualizado_por: BRUNO,
    }
    const servidor = simularServidor([alvo])
    servidor.responder = async () => {
      servidor.itens = [assumido]
      return erroDaApi(409, 'ja_assumido', { atual: assumido })
    }
    renderizar()
    await abrirDetalhes(7)
    await userEvent.click(screen.getByRole('button', { name: 'Remover #7' }))
    const dialogo = await screen.findByRole('alertdialog')
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Remover incidente' }))

    expect(await within(dialogo).findByRole('alert')).toHaveTextContent('Não foi removido')
    expect(
      within(dialogo).getByText(/Não é possível remover: Só Bruno Lima pode editar/),
    ).toBeInTheDocument()
    expect(within(dialogo).queryByRole('button', { name: 'Remover incidente' })).toBeNull()
  })
})

describe('TelaTriagem — incidente Alta novo', () => {
  it('avisa, destaca a linha com "Novo" e "Ver" leva o foco até ela', async () => {
    const servidor = simularServidor([incidente({ id: 1, criticidade: 'alta' })])
    const cliente = renderizar()
    await screen.findByRole('button', { name: 'Ver detalhes de #1' })
    expect(screen.queryByText('Novo incidente Alta')).toBeNull()

    servidor.itens = [
      ...servidor.itens,
      incidente({ id: 9, criticidade: 'alta', titulo: 'Tombamento', atualizado_por: BRUNO }),
    ]
    await cliente.refetchQueries()

    expect(await screen.findByText('Novo incidente Alta')).toBeInTheDocument()
    expect(screen.getByText('#9 · Tombamento')).toBeInTheDocument()
    const linha = document.querySelector('[data-incidente="9"]') as HTMLElement
    expect(within(linha).getByText('Novo')).toBeInTheDocument()
    expect(document.querySelectorAll('p[role="status"].sr-only')[3]).toHaveTextContent(
      'Novo incidente Alta: #9, Tombamento.',
    )

    await userEvent.click(screen.getByRole('button', { name: 'Ver' }))
    expect(within(linha).getByRole('button', { name: 'Ver detalhes de #9' })).toHaveFocus()
    expect(screen.queryByText('Novo incidente Alta')).toBeNull()
  })
})

describe('TelaTriagem — histórico', () => {
  it('mostra o histórico nos detalhes e relê quando o incidente muda', async () => {
    const original = incidente({ id: 7, versao: 1 })
    const servidor = simularServidor([original])
    servidor.eventos = [
      {
        id: 1,
        tipo: 'criado',
        analista: null,
        status_anterior: null,
        status_novo: 'aberto',
        campos: null,
        criado_em: original.criado_em,
      },
    ]
    const cliente = renderizar()
    await abrirDetalhes(7)

    const detalhes = screen.getByRole('group', { name: 'Detalhes de #7' })
    expect(await within(detalhes).findByText('Incidente registrado')).toBeInTheDocument()

    // Bruno assume: a leitura de 5 s traz a versão 2, e o histórico é relido.
    servidor.itens = [
      {
        ...original,
        versao: 2,
        status: 'em_investigacao',
        responsavel: BRUNO,
        atualizado_por: BRUNO,
      },
    ]
    servidor.eventos = [
      ...servidor.eventos,
      {
        id: 2,
        tipo: 'assumido',
        analista: BRUNO,
        status_anterior: 'aberto',
        status_novo: 'em_investigacao',
        campos: null,
        criado_em: new Date().toISOString(),
      },
    ]
    await cliente.refetchQueries({ queryKey: ['incidentes'] })

    expect(await within(detalhes).findByText('Bruno Lima assumiu o incidente')).toBeInTheDocument()
  })
})

