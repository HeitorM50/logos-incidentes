import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import { listarIncidentes } from '@/api/incidentes'
import type { ListaIncidentes } from '@/api/tipos'

export const CHAVE_INCIDENTES = ['incidentes'] as const

// Atualização entre analistas por polling (sem WebSocket). O 409 da API cobre a janela
// entre duas leituras (ADR 0002).
export const INTERVALO_ATUALIZACAO_MS = 5_000

export function useIncidentes(): UseQueryResult<ListaIncidentes> {
  return useQuery({
    queryKey: CHAVE_INCIDENTES,
    queryFn: ({ signal }) => listarIncidentes({}, signal),
    refetchInterval: INTERVALO_ATUALIZACAO_MS,
  })
}

/**
 * - sincronizando: primeira leitura em andamento, ainda sem dados;
 * - ao_vivo: a última leitura deu certo;
 * - reconectando: há dados na tela, mas as leituras recentes falharam;
 * - sem_conexao: nenhuma leitura deu certo até agora.
 *
 * Dois detalhes do TanStack Query que este cálculo cobre:
 * - sem internet, a leitura fica "pausada" e não conta como falha: sem tratar isso, a tela
 *   continuaria dizendo "Ao vivo";
 * - sem dados, cada nova tentativa volta o status para "pending" e apaga o erro: o
 *   `errorUpdateCount` mantém o estado de falha até a primeira leitura dar certo.
 */
export type EstadoConexao = 'sincronizando' | 'ao_vivo' | 'reconectando' | 'sem_conexao'

export function estadoDaConexao(
  consulta: Pick<
    UseQueryResult<unknown>,
    'data' | 'isError' | 'failureCount' | 'fetchStatus' | 'errorUpdateCount'
  >,
): EstadoConexao {
  const pausada = consulta.fetchStatus === 'paused'
  if (consulta.data === undefined) {
    const jaFalhou = consulta.isError || consulta.errorUpdateCount > 0
    return jaFalhou || pausada ? 'sem_conexao' : 'sincronizando'
  }
  if (consulta.isError || consulta.failureCount > 0 || pausada) return 'reconectando'
  return 'ao_vivo'
}
