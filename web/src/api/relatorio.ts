import { requisitar } from './cliente'

// GET /relatorio (api/app/services/relatorio.py): o período e o anterior, do mesmo tamanho.

export const PERIODOS_HORAS = [6, 24, 168] as const
export type PeriodoHoras = (typeof PERIODOS_HORAS)[number]

export interface Metrica {
  atual: number | null
  anterior: number | null
}

export interface Relatorio {
  horas: number
  gerado_em: string
  funil: { etapa: string; quantidade: number }[]
  recebidos: Metrica
  alta: Metrica
  tempo_ate_assumir_min: Metrica
  tempo_ate_fechar_min: Metrica
  taxa_atraso_pct: Metrica
  serie: { inicio: string; total: number; alta: number }[]
}

export function obterRelatorio(horas: PeriodoHoras, sinal?: AbortSignal): Promise<Relatorio> {
  return requisitar('/relatorio', { consulta: { horas }, sinal })
}
