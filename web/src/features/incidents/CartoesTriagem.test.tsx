import { QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Incidente } from '@/api/tipos'
import { criarClienteDeConsultas } from '@/lib/consultas'
import { CONSULTA_CELULAR } from '@/lib/useEhCelular'
import { ANA, incidente, lista, respostaJson } from '@/test/fabricas'
import { TelaTriagem } from './TelaTriagem'

// Abaixo de 1024 px a triagem vira lista de cartões. O jsdom não tem largura de tela: o teste
// responde à consulta de mídia do celular como verdadeira.

function simularCelular() {
  vi.stubGlobal('matchMedia', (consulta: string) => ({
    matches: consulta === CONSULTA_CELULAR,
    addEventListener: () => {},
    removeEventListener: () => {},
  }))
}

function simularServidor(itens: Incidente[]) {
  const posts: string[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (entrada: RequestInfo | URL, init?: RequestInit) => {
      const url = String(entrada)
      if (url.includes('/eventos')) return respostaJson(200, [])
      if (!init?.method || init.method === 'GET') return respostaJson(200, lista(itens))
      posts.push(url)
      return new Promise<Response>(() => {})
    }),
  )
  return posts
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

beforeEach(simularCelular)

afterEach(() => {
  vi.unstubAllGlobals()
  window.history.replaceState(null, '', '/')
})

describe('TelaTriagem — cartões no celular', () => {
  it('mostra um cartão por incidente, na ordem da API, sem a tabela', async () => {
    simularServidor([
      incidente({ id: 3, criticidade: 'alta', titulo: 'Tombamento na BR-116' }),
      incidente({ id: 8, criticidade: 'baixa', titulo: 'Pneu furado' }),
    ])
    renderizar()

    const listaCartoes = await screen.findByRole('list', { name: 'Incidentes' })
    const cartoes = within(listaCartoes).getAllByRole('listitem')
    expect(cartoes).toHaveLength(2)
    expect(within(cartoes[0]).getByText('Tombamento na BR-116')).toBeInTheDocument()
    expect(within(cartoes[0]).getByText('Alta')).toBeInTheDocument()
    expect(within(cartoes[1]).getByText('#8')).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('o cartão tem as mesmas ações e os mesmos detalhes da linha', async () => {
    const posts = simularServidor([incidente({ id: 7, local: 'Km 40, Régis Bittencourt' })])
    renderizar()

    const detalhes = await screen.findByRole('button', { name: 'Ver detalhes de #7' })
    await userEvent.click(detalhes)
    const grupo = screen.getByRole('group', { name: 'Detalhes de #7' })
    expect(within(grupo).getByText('Descrição')).toBeInTheDocument()
    expect(detalhes).toHaveAttribute('aria-expanded', 'true')

    await userEvent.click(screen.getByRole('button', { name: 'Assumir #7' }))
    expect(posts.some((url) => url.endsWith('/incidentes/7/assumir'))).toBe(true)
  })

  it('↓ no botão de detalhes passa para o cartão de baixo', async () => {
    simularServidor([incidente({ id: 1 }), incidente({ id: 2 })])
    renderizar()

    const primeiro = await screen.findByRole('button', { name: 'Ver detalhes de #1' })
    primeiro.focus()
    await userEvent.keyboard('{ArrowDown}')
    expect(screen.getByRole('button', { name: 'Ver detalhes de #2' })).toHaveFocus()
  })
})
