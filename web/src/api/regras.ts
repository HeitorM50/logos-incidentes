import dados from './regras.json'
import type { StatusIncidente } from './tipos'

// Regras de negócio que o front repete para explicar um bloqueio antes do clique e validar o
// formulário antes de enviar. NÃO edite regras.json à mão: ele é gerado pela API a partir do
// próprio código (ciclo de vida e schema Pydantic) e um teste da API falha se divergir:
//
//   cd api && uv run python -m app.regras > ../web/src/api/regras.json
//
// A API continua sendo a autoridade: se o estado mudou entre a leitura e o clique, ela recusa.

export const REGRAS = {
  transicoesDoResponsavel: dados.transicoes_do_responsavel as Partial<
    Record<StatusIncidente, StatusIncidente[]>
  >,
  podeAssumir: dados.pode_assumir as StatusIncidente[],
  statusAposLiberar: dados.status_apos_liberar as Record<StatusIncidente, StatusIncidente>,
  statusFinal: dados.status_final as StatusIncidente[],
  limites: dados.limites,
  padraoPlaca: new RegExp(dados.padrao_placa),
}

/** Status que não aceita mais alteração (hoje: fechado). */
export function ehFinal(status: StatusIncidente): boolean {
  return REGRAS.statusFinal.includes(status)
}
