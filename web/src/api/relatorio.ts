import { requisitar } from './cliente'
import type { Categoria, Criticidade, EventoIncidente, StatusIncidente } from './tipos'

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

export interface IncidenteDoRegistro {
  id: number
  titulo: string
  criticidade: Criticidade
  categoria: Categoria
  status: StatusIncidente
  local: string
  placa: string | null
  origem: string
  responsavel: string | null
  motorista: string | null
  criado_em: string
  assumido_em: string | null
  fechado_em: string | null
  comentario_fechamento: string | null
}

export interface RegistroDoPeriodo {
  horas: number
  inicio: string
  gerado_em: string
  incidentes: IncidenteDoRegistro[]
  eventos: (EventoIncidente & { incidente_id: number; incidente_titulo: string })[]
}

/** Para o PDF: incidentes recebidos ou fechados no período e a linha do tempo dos eventos. */
export function obterRegistro(horas: PeriodoHoras, sinal?: AbortSignal): Promise<RegistroDoPeriodo> {
  return requisitar('/relatorio/registro', { consulta: { horas }, sinal })
}
