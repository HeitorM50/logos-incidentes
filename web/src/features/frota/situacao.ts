import type { VeiculoNoMapa } from '@/api/frota'

// Situação de um caminhão no mapa, a partir da última leitura da telemetria.
export type SituacaoVeiculo = 'incidente' | 'parado' | 'movimento' | 'patio' | 'sem_sinal'

export const ROTULO_SITUACAO: Record<SituacaoVeiculo, string> = {
  incidente: 'Com alerta da telemetria',
  parado: 'Parado na rodovia',
  movimento: 'Em movimento',
  patio: 'No pátio (desligado)',
  sem_sinal: 'Sem sinal',
}

// Ordem da lista: o que pede atenção primeiro.
export const ORDEM_SITUACAO: SituacaoVeiculo[] = [
  'incidente',
  'parado',
  'movimento',
  'patio',
  'sem_sinal',
]

const PESO_CRITICIDADE = { alta: 0, media: 1, baixa: 2 } as const

export function situacaoDoVeiculo(veiculo: VeiculoNoMapa): SituacaoVeiculo {
  if (veiculo.latitude === null || veiculo.longitude === null) return 'sem_sinal'
  if (veiculo.incidente) return 'incidente'
  if (!veiculo.ignicao) return 'patio'
  if ((veiculo.velocidade_kmh ?? 0) <= 3) return 'parado'
  return 'movimento'
}

/** Com incidente primeiro (Alta antes), depois parados, em movimento, no pátio e sem sinal. */
export function ordenarVeiculos(veiculos: VeiculoNoMapa[]): VeiculoNoMapa[] {
  return [...veiculos].sort((a, b) => {
    const sa = ORDEM_SITUACAO.indexOf(situacaoDoVeiculo(a))
    const sb = ORDEM_SITUACAO.indexOf(situacaoDoVeiculo(b))
    if (sa !== sb) return sa - sb
    if (a.incidente && b.incidente) {
      return PESO_CRITICIDADE[a.incidente.criticidade] - PESO_CRITICIDADE[b.incidente.criticidade]
    }
    return a.placa.localeCompare(b.placa)
  })
}
