import { QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AnalistaLogado, Incidente } from '@/api/tipos'
import { criarClienteDeConsultas } from '@/lib/consultas'
import { ANA, BRUNO, incidente, lista, respostaJson } from '@/test/fabricas'
import { TelaTriagem } from './TelaTriagem'

const CARLA: AnalistaLogado = { id: 3, nome: 'Carla Mendes', usuario: 'carla', papel: 'supervisor' }

function simularServidor(itens: Incidente[]) {
  const posts: { url: string; corpo: unknown }[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (entrada: RequestInfo | URL, init?: RequestInit) => {
      const url = String(entrada)
      if (url.includes('/eventos')) return respostaJson(200, [])
      if (url.endsWith('/analistas')) {
        return respostaJson(200, [
          { ...ANA, papel: 'analista' },
          { ...BRUNO, papel: 'analista' },
          { id: 3, nome: 'Carla Mendes', papel: 'supervisor' },
        ])
      }
      if (!init?.method || init.method === 'GET') return respostaJson(200, lista(itens))
      posts.push({ url, corpo: JSON.parse(String(init.body)) })
      return new Promise<Response>(() => {})
    }),
  )
  return posts
}

function renderizar(analista: AnalistaLogado) {
  const cliente = criarClienteDeConsultas()
  cliente.setDefaultOptions({ queries: { retry: false } })
  render(
    <QueryClientProvider client={cliente}>
      <TelaTriagem analista={analista} aoSair={() => {}} />
    </QueryClientProvider>,
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
  window.history.replaceState(null, '', '/')
})

describe('TelaTriagem — transferir (supervisor)', () => {
  it('a supervisora escolhe o novo responsável e a linha muda na hora', async () => {
    const posts = simularServidor([
      incidente({ id: 7, versao: 4, status: 'em_investigacao', responsavel: ANA }),
    ])
    renderizar(CARLA)

    await userEvent.click(await screen.findByRole('button', { name: 'Ver detalhes de #7' }))
    await userEvent.click(screen.getByRole('button', { name: 'Transferir #7' }))
    const dialogo = await screen.findByRole('alertdialog', { name: 'Transferir o incidente #7' })

    // Sem escolher, não envia.
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Transferir' }))
    expect(within(dialogo).getByRole('alert')).toHaveTextContent('Escolha o novo responsável.')

    const destino = await within(dialogo).findByRole('combobox', { name: 'Novo responsável' })
    // A responsável atual não aparece como destino.
    expect(within(destino).queryByRole('option', { name: 'Ana Souza' })).toBeNull()
    await userEvent.selectOptions(destino, 'Bruno Lima')
    await userEvent.type(within(dialogo).getByRole('textbox'), 'Troca de turno')
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Transferir' }))

    expect(posts).toEqual([
      {
        url: expect.stringMatching(/\/incidentes\/7\/transferir$/),
        corpo: { versao: 4, analista_id: BRUNO.id, comentario: 'Troca de turno' },
      },
    ])
    const linha = document.querySelector<HTMLElement>('[data-incidente="7"]')!
    expect(within(linha).getByText('Bruno Lima')).toBeInTheDocument()
  })

  it('analista comum não vê "Transferir"', async () => {
    simularServidor([incidente({ id: 7 })])
    renderizar({ ...ANA, usuario: 'ana', papel: 'analista' })

    await userEvent.click(await screen.findByRole('button', { name: 'Ver detalhes de #7' }))
    expect(screen.queryByRole('button', { name: 'Transferir #7' })).toBeNull()
  })
})
