import type { QueryClient } from '@tanstack/react-query'
import type { Incidente, ListaIncidentes } from '@/api/tipos'
import { CHAVE_INCIDENTES } from './useIncidentes'

/** Grava no cache uma versão vinda da API, sem voltar se o cache já tem uma mais nova. */
export function gravarVersao(cliente: QueryClient, novo: Incidente) {
  cliente.setQueryData<ListaIncidentes>(CHAVE_INCIDENTES, (lista) =>
    lista
      ? {
          ...lista,
          itens: lista.itens.map((item) =>
            item.id === novo.id && novo.versao >= item.versao ? novo : item,
          ),
        }
      : lista,
  )
}

export function removerDaLista(cliente: QueryClient, id: number) {
  cliente.setQueryData<ListaIncidentes>(CHAVE_INCIDENTES, (lista) =>
    lista ? { ...lista, itens: lista.itens.filter((item) => item.id !== id) } : lista,
  )
}

/** Relê a lista e cancela uma leitura iniciada antes da gravação (traria a versão velha). */
export function relerLista(cliente: QueryClient) {
  return cliente.invalidateQueries({ queryKey: CHAVE_INCIDENTES })
}
