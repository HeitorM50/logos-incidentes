import { QueryClientProvider } from '@tanstack/react-query'
import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { RegistroDoPeriodo, Relatorio } from '@/api/relatorio'
import { criarClienteDeConsultas } from '@/lib/consultas'
import { ANA, incidente, lista, respostaJson } from '@/test/fabricas'
import { TelaTriagem } from '@/features/incidents/TelaTriagem'

// Os gráficos do reaviz precisam de medidas de layout que o jsdom não tem; aqui eles viram
// nada, e o teste confere os números e o funil em texto (o que o leitor de tela recebe).
vi.mock('reaviz', () => {
  const Nada = () => null
  return {
    AreaSeries: Nada,
    AreaSparklineChart: Nada,
    FunnelArc: Nada,
    FunnelAxis: Nada,
    FunnelAxisLabel: Nada,
    FunnelAxisLine: Nada,
    FunnelChart: Nada,
    FunnelSeries: Nada,
  }
})

const RELATORIO: Relatorio = {
  horas: 6,
  gerado_em: '2026-10-20T15:00:00Z',
  funil: [
    { etapa: 'Recebidos', quantidade: 20 },
    { etapa: 'Assumidos', quantidade: 12 },
    { etapa: 'Assumidos no prazo', quantidade: 9 },
    { etapa: 'Fechados', quantidade: 5 },
  ],
  recebidos: { atual: 20, anterior: 16 },
  alta: { atual: 6, anterior: 0 },
  tempo_ate_assumir_min: { atual: 65, anterior: 80 },
  tempo_ate_fechar_min: { atual: null, anterior: null },
  taxa_atraso_pct: { atual: 15, anterior: 10 },
  serie: [{ inicio: '2026-10-20T09:00:00Z', total: 3, alta: 1 }],
}

const REGISTRO: RegistroDoPeriodo = {
  horas: 6,
  inicio: '2026-10-20T09:00:00Z',
  gerado_em: '2026-10-20T15:00:00Z',
  incidentes: [
    {
      id: 7,
      titulo: 'Tombamento na serra',
      criticidade: 'alta',
      categoria: 'acidente_veiculo',
      status: 'fechado',
      local: 'BR-376, km 668',
      placa: 'RTA4E21',
      origem: 'Central',
      responsavel: 'Ana Souza',
      motorista: 'José Almeida',
      criado_em: '2026-10-20T10:00:00Z',
      assumido_em: '2026-10-20T10:05:00Z',
      fechado_em: '2026-10-20T11:00:00Z',
      comentario_fechamento: 'Guincho removeu o veículo',
    },
  ],
  eventos: [
    {
      id: 1,
      tipo: 'status',
      analista: ANA,
      status_anterior: 'em_investigacao',
      status_novo: 'fechado',
      campos: null,
      comentario: 'Guincho removeu o veículo',
      criado_em: '2026-10-20T11:00:00Z',
      incidente_id: 7,
      incidente_titulo: 'Tombamento na serra',
    },
  ],
}

function montar() {
  const pedidos: string[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (entrada: RequestInfo | URL) => {
      const url = String(entrada)
      pedidos.push(url)
      if (url.includes('/relatorio/registro')) return respostaJson(200, REGISTRO)
      if (url.includes('/relatorio')) return respostaJson(200, RELATORIO)
      return respostaJson(200, lista([incidente({ id: 1 })]))
    }),
  )
  const cliente = criarClienteDeConsultas()
  cliente.setDefaultOptions({ queries: { retry: false } })
  render(
    <QueryClientProvider client={cliente}>
      <TelaTriagem analista={ANA} aoSair={() => {}} />
    </QueryClientProvider>,
  )
  return pedidos
}

afterEach(() => {
  vi.unstubAllGlobals()
  window.history.replaceState(null, '', '/')
})

describe('Relatório', () => {
  it('abre pelo botão da triagem e mostra o funil, os tempos e as variações', async () => {
    const pedidos: string[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (entrada: RequestInfo | URL) => {
        const url = String(entrada)
        if (url.includes('/relatorio')) {
          pedidos.push(url)
          return respostaJson(200, RELATORIO)
        }
        return respostaJson(200, lista([incidente({ id: 1 })]))
      }),
    )
    const cliente = criarClienteDeConsultas()
    cliente.setDefaultOptions({ queries: { retry: false } })
    render(
      <QueryClientProvider client={cliente}>
        <TelaTriagem analista={ANA} aoSair={() => {}} />
      </QueryClientProvider>,
    )

    // Fechado, o relatório não é pedido.
    await screen.findByRole('button', { name: 'Ver detalhes de #1' })
    expect(pedidos).toEqual([])

    await userEvent.click(screen.getByRole('button', { name: 'Relatório' }))
    const painel = await screen.findByRole('dialog', { name: 'Relatório de incidentes' })
    expect(pedidos[0]).toMatch(/\/relatorio\?horas=6$/)

    expect(await within(painel).findByText('Assumidos no prazo: 9')).toBeInTheDocument()
    expect(within(painel).getByText('1 h 05 min')).toBeInTheDocument()
    // Tempo caiu: melhorou (o texto diz, além da cor e da seta).
    expect(within(painel).getByText(/−19%/).closest('span')).toHaveTextContent('(melhorou)')
    // Atraso subiu 50%: piorou.
    expect(within(painel).getByText(/\+50%/).closest('span')).toHaveTextContent('(piorou)')
    // Sem base no período anterior, não inventa variação.
    expect(within(painel).getAllByText('sem comparação').length).toBeGreaterThan(0)

    await userEvent.selectOptions(within(painel).getByRole('combobox', { name: 'Período' }), '24')
    await vi.waitFor(() => expect(pedidos.at(-1)).toMatch(/horas=24$/))
  })

  it('"Exportar PDF" monta o documento do período e abre a impressão', async () => {
    const imprimir = vi.fn()
    vi.stubGlobal('print', imprimir)
    const pedidos = montar()

    await userEvent.click(await screen.findByRole('button', { name: 'Relatório' }))
    const painel = await screen.findByRole('dialog', { name: 'Relatório de incidentes' })
    await within(painel).findByText('Assumidos no prazo: 9')
    await userEvent.click(within(painel).getByRole('button', { name: 'Exportar PDF' }))

    await vi.waitFor(() => expect(imprimir).toHaveBeenCalledTimes(1))
    expect(pedidos.some((url) => /\/relatorio\/registro\?horas=6$/.test(url))).toBe(true)
    const documento = document.querySelector<HTMLElement>('.documento-impressao')!
    expect(document.documentElement).toHaveClass('imprimindo')
    expect(document.title).toBe('Logos - relatorio de incidentes - 2026-10-20')
    // O documento não diz "Você": quem lê o PDF não é quem gerou.
    expect(documento).toHaveTextContent('Ana Souza mudou o status de Em Investigação para Fechado')
    expect(documento).toHaveTextContent('“Guincho removeu o veículo”')
    expect(documento).toHaveTextContent('por Ana Souza')

    // Fechou o diálogo de impressão: o documento sai e a aba volta ao título de antes.
    act(() => {
      window.dispatchEvent(new Event('afterprint'))
    })
    expect(document.documentElement).not.toHaveClass('imprimindo')
    expect(document.querySelector('.documento-impressao')).toBeNull()
  })
})
