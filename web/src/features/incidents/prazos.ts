import { REGRAS } from '@/api/regras'
import { ROTULO_CRITICIDADE } from '@/api/rotulos'
import type { Incidente } from '@/api/tipos'
import { minutosDesde } from './tempo'

// Prazo para alguém assumir, por criticidade (regras da API: Alta 15 min, Média 60, Baixa 240).
// Incidente ativo sem responsável além do prazo está ATRASADO: é o que está sendo esquecido.
// Conta desde a abertura: um incidente liberado volta para a fila com o atraso que já tinha.

export function estaAtrasado(incidente: Incidente, agora: number): boolean {
  if (incidente.status === 'fechado' || incidente.responsavel) return false
  return minutosDesde(incidente.criado_em, agora) > REGRAS.prazoParaAssumirMin[incidente.criticidade]
}

/** "Sem responsável além do prazo da Alta (15 min)", para o título do marcador. */
export function explicarAtraso(incidente: Incidente): string {
  const prazo = REGRAS.prazoParaAssumirMin[incidente.criticidade]
  return `Sem responsável além do prazo da ${ROTULO_CRITICIDADE[incidente.criticidade]} (${prazo} min)`
}
