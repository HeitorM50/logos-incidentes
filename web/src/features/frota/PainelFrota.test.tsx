import { QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { MapaDaFrota, VeiculoNoMapa } from '@/api/frota'
import { criarClienteDeConsultas } from '@/lib/consultas'
import { respostaJson } from '@/test/fabricas'
import { PainelFrota } from './PainelFrota'
import { ordenarVeiculos, situacaoDoVeiculo } from './situacao'

function veiculo(dados: Partial<VeiculoNoMapa>): VeiculoNoMapa {
  return {
    placa: 'AAA1A11',
    modelo: 'Volvo FH 540',
    motorista: 'José Almeida',
    latitude: -23.5,
    longitude: -46.6,
    velocidade_kmh: 80,
    ignicao: true,
    referencia: 'Rod. Presidente Dutra, km 380 — São Paulo/SP',
    ultima_leitura_em: new Date().toISOString(),
    parado_desde: null,
    incidente: null,
    ...dados,
  }
}

const MAPA: MapaDaFrota = {
  rotas: [{ rodovia: 'Rod. Presidente Dutra', pontos: [[-22.9, -43.2], [-23.55, -46.63]] }],
  veiculos: [
    veiculo({ placa: 'MOV1A11' }),
    veiculo({ placa: 'PAT1A11', ignicao: false, velocidade_kmh: 0, motorista: null }),
    veiculo({ placa: 'PAR1A11', velocidade_kmh: 0 }),
    veiculo({
      placa: 'ALT1A11',
      incidente: { id: 42, titulo: 'Botão de pânico acionado pelo motorista', criticidade: 'alta' },
    }),
  ],
}

afterEach(() => vi.unstubAllGlobals())

describe('situação do caminhão', () => {
  it('classifica e ordena: alerta, parado, em movimento, pátio', () => {
    expect(MAPA.veiculos.map(situacaoDoVeiculo)).toEqual(['movimento', 'patio', 'parado', 'incidente'])
    expect(ordenarVeiculos(MAPA.veiculos).map((v) => v.placa)).toEqual([
      'ALT1A11',
      'PAR1A11',
      'MOV1A11',
      'PAT1A11',
    ])
    expect(situacaoDoVeiculo(veiculo({ latitude: null }))).toBe('sem_sinal')
  })
})

describe('PainelFrota', () => {
  it('mostra os contadores e a lista, e o alerta leva até o incidente', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => respostaJson(200, MAPA)))
    const aoVerIncidente = vi.fn()
    const aoMudar = vi.fn()
    render(
      <QueryClientProvider client={criarClienteDeConsultas()}>
        <PainelFrota aberto aoMudar={aoMudar} aoVerIncidente={aoVerIncidente} />
      </QueryClientProvider>,
    )

    const resumo = await screen.findByRole('list', { name: 'Resumo da frota' })
    expect(resumo).toHaveTextContent('Com alerta da telemetria1')
    expect(resumo).toHaveTextContent('Parado na rodovia1')
    expect(resumo).toHaveTextContent('No pátio (desligado)1')

    const tabela = screen.getByRole('table')
    const linhas = within(tabela).getAllByRole('row').slice(1)
    expect(linhas[0]).toHaveTextContent('ALT1A11')
    expect(linhas[3]).toHaveTextContent('Sem motorista')

    await userEvent.click(
      within(tabela).getByRole('button', { name: '#42 Botão de pânico acionado pelo motorista' }),
    )
    expect(aoMudar).toHaveBeenCalledWith(false)
    expect(aoVerIncidente).toHaveBeenCalledWith(42)
  })
})
