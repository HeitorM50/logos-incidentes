import { requisitar } from './cliente'
import type { Criticidade } from './tipos'

// GET /frota (api/app/services/frota.py): rodovias da simulação e a última posição de cada
// caminhão, vinda da telemetria.

export interface VeiculoNoMapa {
  placa: string
  modelo: string
  motorista: string | null
  latitude: number | null
  longitude: number | null
  velocidade_kmh: number | null
  ignicao: boolean | null
  referencia: string | null
  ultima_leitura_em: string | null
  parado_desde: string | null
  incidente: { id: number; titulo: string; criticidade: Criticidade } | null
}

export interface MapaDaFrota {
  rotas: { rodovia: string; pontos: [number, number][] }[]
  veiculos: VeiculoNoMapa[]
}

export function obterMapaDaFrota(sinal?: AbortSignal): Promise<MapaDaFrota> {
  return requisitar('/frota', { sinal })
}
