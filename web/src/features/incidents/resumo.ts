import {
  CRITICIDADES,
  type Criticidade,
  type Incidente,
  type StatusIncidente,
} from '@/api/tipos'
import { minutosDesde } from './tempo'

export type StatusAtivo = Exclude<StatusIncidente, 'fechado'>
export const STATUS_ATIVOS: StatusAtivo[] = ['aberto', 'em_investigacao', 'inconclusivo']

export interface ResumoCriticidade {
  quantidade: number
  /** Minutos do incidente ativo mais antigo; null quando não há ativo. */
  maisAntigoMin: number | null
}

export interface ResumoTriagem {
  ativos: number
  fechados: number
  porStatus: Record<StatusAtivo, number>
  porCriticidade: Record<Criticidade, ResumoCriticidade>
}

/**
 * Números do topo da triagem. Contam só incidentes ativos: um fechado não pede ação, e
 * contá-lo inflaria o "Alta 31" que o analista lê primeiro.
 */
export function resumirTriagem(itens: Incidente[], agora: number): ResumoTriagem {
  const porStatus: Record<StatusAtivo, number> = { aberto: 0, em_investigacao: 0, inconclusivo: 0 }
  const porCriticidade = Object.fromEntries(
    CRITICIDADES.map((c) => [c, { quantidade: 0, maisAntigoMin: null }]),
  ) as Record<Criticidade, ResumoCriticidade>
  let fechados = 0

  for (const incidente of itens) {
    if (incidente.status === 'fechado') {
      fechados++
      continue
    }
    porStatus[incidente.status]++
    const resumo = porCriticidade[incidente.criticidade]
    resumo.quantidade++
    const minutos = minutosDesde(incidente.criado_em, agora)
    resumo.maisAntigoMin = Math.max(resumo.maisAntigoMin ?? 0, minutos)
  }

  return { ativos: itens.length - fechados, fechados, porStatus, porCriticidade }
}

/** "1 ativo", "3 ativos". */
export function quantosAtivos(n: number): string {
  return `${n} ${n === 1 ? 'ativo' : 'ativos'}`
}

/** "3 ativos", "1 fechado" ou "5 incidentes", conforme a situação escolhida no seletor. */
export function quantosNaSituacao(n: number, situacao: 'ativos' | 'fechados' | 'todos'): string {
  if (situacao === 'ativos') return quantosAtivos(n)
  if (situacao === 'fechados') return `${n} ${n === 1 ? 'fechado' : 'fechados'}`
  return `${n} ${n === 1 ? 'incidente' : 'incidentes'}`
}
