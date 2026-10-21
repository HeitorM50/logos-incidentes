import { requisitar } from './cliente'
import type { Categoria, Criticidade } from './tipos'

/** Campos que a IA leu na mensagem do motorista (ADR 0014). O analista confere antes de salvar. */
export interface Sugestao {
  titulo: string
  descricao: string
  categoria: Categoria
  criticidade: Criticidade
  local: string | null
  placa: string | null
  motorista_nome: string | null
  justificativa: string
}

/** A API só liga a sugestão quando tem a chave de um provedor de IA (Gemini ou Anthropic). */
export function obterDisponibilidadeSugestao(sinal?: AbortSignal): Promise<{ disponivel: boolean }> {
  return requisitar('/sugestao', { sinal })
}

export function sugerirIncidente(mensagem: string): Promise<Sugestao> {
  return requisitar('/sugestao', { metodo: 'POST', corpo: { mensagem } })
}
