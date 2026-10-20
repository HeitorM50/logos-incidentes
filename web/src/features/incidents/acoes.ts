import { ehFinal, exigeComentario, REGRAS } from '@/api/regras'
import { ROTULO_STATUS } from '@/api/rotulos'
import type { AnalistaResumo, Incidente, StatusIncidente } from '@/api/tipos'

// O front usa as regras da API (src/api/regras.ts, geradas do código da API) para desativar
// o que a API recusaria e dizer o motivo; a API continua sendo a autoridade e devolve
// 403/409/422 se o estado mudou entre a leitura e o clique.

// `comentario`: obrigatório ao fechar e ao marcar inconclusivo (regras da API), opcional ao
// liberar.
export type Acao =
  | { tipo: 'assumir' }
  | { tipo: 'liberar'; comentario?: string }
  | { tipo: 'status'; status: StatusIncidente; comentario?: string }
  // Só o supervisor: passa o incidente para outro analista.
  | { tipo: 'transferir'; para: AnalistaResumo; comentario?: string }

/** Comentário que o desfazer envia quando volta para um status que exige comentário. */
export function comentarioDoDesfazer(status: StatusIncidente): string {
  return `Desfeito: volta para ${ROTULO_STATUS[status]}.`
}

export const TRANSICOES_DO_RESPONSAVEL = REGRAS.transicoesDoResponsavel

/** Nome curto da ação, como aparece nos avisos. */
export function nomeDaAcao(acao: Acao): string {
  if (acao.tipo === 'assumir') return 'Assumir'
  if (acao.tipo === 'liberar') return 'Liberar'
  if (acao.tipo === 'transferir') return `Transferir para ${acao.para.nome}`
  return `Mudar status para ${ROTULO_STATUS[acao.status]}`
}

/** Texto anunciado ao leitor de tela quando a ação começa. */
export function anuncioPendente(acao: Acao, id: number): string {
  if (acao.tipo === 'assumir') return `Assumindo #${id}…`
  if (acao.tipo === 'liberar') return `Liberando #${id}…`
  if (acao.tipo === 'transferir') return `Transferindo #${id} para ${acao.para.nome}…`
  return `Mudando o status de #${id} para ${ROTULO_STATUS[acao.status]}…`
}

/** Texto do estado "em andamento" da linha. */
export function textoPendente(acao: Acao): string {
  if (acao.tipo === 'assumir') return 'Assumindo…'
  if (acao.tipo === 'liberar') return 'Liberando…'
  if (acao.tipo === 'transferir') return 'Transferindo…'
  return 'Salvando status…'
}

/**
 * Motivo pelo qual o analista não pode fazer a ação agora, ou null quando pode. O texto
 * aparece junto do botão desativado.
 */
export function motivoBloqueio(
  incidente: Incidente,
  acao: Acao,
  idAnalista: number,
): string | null {
  if (ehFinal(incidente.status)) return 'Incidente fechado: não aceita mais alterações.'
  const responsavel = incidente.responsavel
  const meu = responsavel?.id === idAnalista

  if (acao.tipo === 'transferir') {
    // Quem pode transferir (supervisor) a tela já decidiu; aqui só o que a API recusaria.
    if (responsavel?.id === acao.para.id) return `${acao.para.nome} já é o responsável.`
    return null
  }

  if (acao.tipo === 'assumir') {
    if (meu) return 'Você já é o responsável.'
    if (responsavel) return `${responsavel.nome} é o responsável por este incidente.`
    if (!REGRAS.podeAssumir.includes(incidente.status)) {
      return 'Este incidente não pode ser assumido agora.'
    }
    return null
  }

  if (!responsavel) {
    return acao.tipo === 'liberar'
      ? 'O incidente não tem responsável.'
      : 'Assuma o incidente para mudar o status.'
  }
  if (!meu) {
    return acao.tipo === 'liberar'
      ? `Só ${responsavel.nome} pode liberar este incidente.`
      : `Só ${responsavel.nome} pode mudar o status.`
  }
  if (acao.tipo === 'status') {
    const permitidos = TRANSICOES_DO_RESPONSAVEL[incidente.status] ?? []
    if (!permitidos.includes(acao.status)) {
      const de = ROTULO_STATUS[incidente.status]
      return `Não é possível mudar de ${de} para ${ROTULO_STATUS[acao.status]}.`
    }
  }
  return null
}

/** O incidente como ficará se a API aceitar a ação (atualização otimista). */
export function aplicarAcao(
  incidente: Incidente,
  acao: Acao,
  analista: AnalistaResumo,
): Incidente {
  const agora = new Date().toISOString()
  const base = { ...incidente, atualizado_em: agora, atualizado_por: analista }
  if (acao.tipo === 'assumir') {
    return { ...base, responsavel: analista, status: 'em_investigacao' }
  }
  if (acao.tipo === 'liberar') {
    const status = REGRAS.statusAposLiberar[incidente.status]
    return { ...base, responsavel: null, status }
  }
  if (acao.tipo === 'transferir') {
    const status = incidente.status === 'aberto' ? 'em_investigacao' : incidente.status
    return { ...base, responsavel: acao.para, status }
  }
  return { ...base, status: acao.status }
}

/** "Aberto, sem responsável" / "Em Investigação, com Bruno Lima". */
export function descreverEstado(incidente: Incidente, idAnalista: number): string {
  const status = ROTULO_STATUS[incidente.status]
  const r = incidente.responsavel
  if (!r) return `${status}, sem responsável`
  return `${status}, com ${r.id === idAnalista ? 'você' : r.nome}`
}

/**
 * Ações que devolvem o incidente ao estado de antes, ou null quando não há desfazer (fechar é
 * final). Usa só as regras normais da API: o desfazer é uma ação nova, com a versão atual.
 * Dois casos pedem dois passos, porque assumir sempre leva a Em Investigação e liberar só
 * devolve Em Investigação para Aberto:
 * - assumir um Inconclusivo → voltar a Inconclusivo e liberar;
 * - liberar um Inconclusivo → assumir e voltar a Inconclusivo.
 */
export function acoesParaDesfazer(antes: Incidente, acao: Acao): Acao[] | null {
  const inconclusivo: Acao = {
    tipo: 'status',
    status: 'inconclusivo',
    comentario: comentarioDoDesfazer('inconclusivo'),
  }
  if (acao.tipo === 'assumir') {
    return antes.status === 'inconclusivo'
      ? [inconclusivo, { tipo: 'liberar' }]
      : [{ tipo: 'liberar' }]
  }
  if (acao.tipo === 'liberar') {
    return antes.status === 'inconclusivo'
      ? [{ tipo: 'assumir' }, inconclusivo]
      : [{ tipo: 'assumir' }]
  }
  if (acao.tipo === 'transferir') {
    // Volta para quem era o responsável. Sem responsável antes, não há como desfazer (só o
    // responsável libera, e quem transferiu foi o supervisor).
    return antes.responsavel ? [{ tipo: 'transferir', para: antes.responsavel }] : null
  }
  if (ehFinal(acao.status)) return null
  return [
    exigeComentario(antes.status)
      ? { tipo: 'status', status: antes.status, comentario: comentarioDoDesfazer(antes.status) }
      : { tipo: 'status', status: antes.status },
  ]
}
