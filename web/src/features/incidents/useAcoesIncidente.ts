import {
  useMutation,
  useMutationState,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query'
import { useCallback, useMemo, useRef, useState } from 'react'
import { ehErroApi } from '@/api/erros'
import { assumirIncidente, liberarIncidente, mudarStatus } from '@/api/incidentes'
import { ROTULO_STATUS } from '@/api/rotulos'
import type { AnalistaResumo, Incidente, ListaIncidentes } from '@/api/tipos'
import { anuncioPendente, aplicarAcao, descreverEstado, motivoBloqueio, type Acao } from './acoes'
import { CHAVE_ACAO_INCIDENTE, CHAVE_INCIDENTES } from './useIncidentes'

// Atualização otimista por sobreposição: o cache guarda só o que a API confirmou, e a tela
// aplica por cima as ações em andamento. Assim:
// - a leitura a cada 5 s nunca apaga o estado otimista (ela não o conhece);
// - na falha não há "rollback" a gravar: a ação sai da lista de pendentes e a linha volta
//   sozinha ao último estado confirmado, inclusive se ele mudou durante a espera;
// - uma ação nunca desfaz a mudança de outra linha.

interface Variaveis {
  /** O incidente como o analista o via no clique (inclui a versão lida). */
  incidente: Incidente
  acao: Acao
}

/** 409: outro analista alterou o incidente antes. A linha já mostra a versão atual. */
export interface Conflito {
  acao: Acao
  /** Versão que a API devolveu no 409: se a linha mudar de novo, o aviso deixa de valer. */
  versao: number
  /** Nome de quem alterou; null quando a API não informa. */
  autor: string | null
}

/** Falha de uma ação; a linha já voltou ao último estado confirmado. */
export interface AvisoFalha {
  id: number
  /** Versão do incidente na falha: se a linha mudar depois, o aviso deixa de valer. */
  versao: number
  acao: Acao
  titulo: string
  detalhe: string
  /** Falha passageira: tentar de novo pode dar certo. */
  podeRepetir: boolean
  /** O incidente saiu da lista (404): o aviso vale mesmo sem a linha. */
  removido?: boolean
}

function chamarApi({ incidente, acao }: Variaveis): Promise<Incidente> {
  if (acao.tipo === 'assumir') return assumirIncidente(incidente.id, incidente.versao)
  if (acao.tipo === 'liberar') return liberarIncidente(incidente.id, incidente.versao)
  return mudarStatus(incidente.id, incidente.versao, acao.status)
}

/** Grava no cache uma versão vinda da API, sem voltar se o cache já tem uma mais nova. */
function gravarVersao(cliente: QueryClient, novo: Incidente) {
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

function removerDaLista(cliente: QueryClient, id: number) {
  cliente.setQueryData<ListaIncidentes>(CHAVE_INCIDENTES, (lista) =>
    lista ? { ...lista, itens: lista.itens.filter((item) => item.id !== id) } : lista,
  )
}

function semChave<T>(registro: Record<number, T>, id: number): Record<number, T> {
  if (!(id in registro)) return registro
  const copia = { ...registro }
  delete copia[id]
  return copia
}

function verbo(acao: Acao): string {
  if (acao.tipo === 'assumir') return 'assumir'
  if (acao.tipo === 'liberar') return 'liberar'
  return 'mudar o status de'
}

function textoSucesso(acao: Acao, novo: Incidente): string {
  if (acao.tipo === 'assumir') return `Você assumiu #${novo.id}.`
  if (acao.tipo === 'liberar') return `Você liberou #${novo.id}.`
  return `#${novo.id} agora está ${ROTULO_STATUS[novo.status]}.`
}

function montarAviso(
  erro: unknown,
  { incidente, acao }: Variaveis,
  idAnalista: number,
): AvisoFalha {
  const base = { id: incidente.id, versao: incidente.versao, acao }
  const titulo = `Não foi possível ${verbo(acao)} #${incidente.id}. A ação foi desfeita.`

  if (!ehErroApi(erro) || erro.codigo === 'erro_interno' || erro.codigo === 'resposta_invalida') {
    // A ação pode ter sido gravada antes do erro: a lista é relida e o analista confere.
    return {
      ...base,
      titulo: `Erro inesperado ao ${verbo(acao)} #${incidente.id}.`,
      detalhe: 'A lista foi relida. Confira a linha antes de tentar de novo.',
      podeRepetir: false,
    }
  }
  if (erro.codigo === 'nao_encontrado') {
    return {
      ...base,
      titulo: `O incidente #${incidente.id} não existe mais.`,
      detalhe: 'Outro analista o removeu. A linha saiu da lista.',
      podeRepetir: false,
      removido: true,
    }
  }
  if (erro.ehTransitorio) {
    const estado = descreverEstado(incidente, idAnalista)
    return {
      ...base,
      titulo,
      detalhe:
        `O incidente voltou ao estado anterior (${estado}). ` +
        'Verifique a conexão e tente de novo.',
      podeRepetir: true,
    }
  }
  // Regra recusada (403/422): o estado mudou desde a leitura. Repetir daria o mesmo erro.
  return { ...base, titulo, detalhe: `${erro.message} A lista foi relida.`, podeRepetir: false }
}

export type AcoesIncidente = ReturnType<typeof useAcoesIncidente>

/**
 * Assumir, liberar e mudar status. A API responde com a versão nova (gravada no cache),
 * com 409 (a linha mostra a versão atual e o aviso de conflito) ou com falha (aviso
 * flutuante; a linha volta sozinha ao estado confirmado).
 */
export function useAcoesIncidente(analista: AnalistaResumo) {
  const cliente = useQueryClient()
  const [conflitos, setConflitos] = useState<Record<number, Conflito>>({})
  const [avisos, setAvisos] = useState<AvisoFalha[]>([])
  /** Texto da região viva: início, fim e conflito de cada ação. */
  const [anuncio, setAnuncio] = useState('')
  // Guarda contra clique duplo: o estado do React só atualiza no próximo render, o ref na hora.
  const emAndamento = useRef(new Set<number>())

  const { mutate } = useMutation({
    mutationKey: CHAVE_ACAO_INCIDENTE,
    mutationFn: chamarApi,
    onSuccess: (novo, { acao }) => {
      gravarVersao(cliente, novo)
      setAnuncio(textoSucesso(acao, novo))
    },
    onError: (erro, variaveis) => {
      const { incidente, acao } = variaveis
      if (ehErroApi(erro) && erro.ehConflito && erro.atual) {
        const atual = erro.atual
        gravarVersao(cliente, atual)
        const autor = atual.atualizado_por
        const quem = autor ? (autor.id === analista.id ? 'Você' : autor.nome) : null
        setConflitos((todos) => ({
          ...todos,
          [incidente.id]: { acao, versao: atual.versao, autor: quem },
        }))
        setAnuncio(
          `#${incidente.id}: ${quem ?? 'outro analista'} alterou este incidente antes. ` +
            'Sua ação não foi aplicada.',
        )
        return
      }
      if (ehErroApi(erro) && erro.codigo === 'nao_encontrado') {
        removerDaLista(cliente, incidente.id)
      }
      const aviso = montarAviso(erro, variaveis, analista.id)
      setAvisos((todos) => [...todos.filter((a) => a.id !== aviso.id), aviso])
    },
    onSettled: (_dados, _erro, { incidente }) => {
      emAndamento.current.delete(incidente.id)
      // Relê a lista e cancela uma leitura iniciada antes da gravação (traria a versão velha).
      void cliente.invalidateQueries({ queryKey: CHAVE_INCIDENTES })
    },
  })

  const fecharAviso = useCallback((id: number) => {
    setAvisos((todos) => todos.filter((a) => a.id !== id))
  }, [])

  const executar = useCallback(
    (incidente: Incidente, acao: Acao) => {
      if (emAndamento.current.has(incidente.id)) return
      setConflitos((todos) => semChave(todos, incidente.id))
      fecharAviso(incidente.id)
      // A regra pode ter mudado desde o aviso (ex.: "Tentar de novo" depois que outro
      // analista assumiu). A linha já mostra o motivo; não vale chamar a API.
      if (motivoBloqueio(incidente, acao, analista.id)) return
      emAndamento.current.add(incidente.id)
      setAnuncio(anuncioPendente(acao, incidente.id))
      mutate({ incidente, acao })
    },
    [mutate, fecharAviso, analista.id],
  )

  const dispensarConflito = useCallback((id: number) => {
    setConflitos((todos) => semChave(todos, id))
  }, [])

  const variaveisPendentes = useMutationState({
    filters: { mutationKey: CHAVE_ACAO_INCIDENTE, status: 'pending' },
    select: (m) => m.state.variables as Variaveis | undefined,
  })
  const pendentes = useMemo(() => {
    const mapa = new Map<number, Acao>()
    for (const v of variaveisPendentes) if (v) mapa.set(v.incidente.id, v.acao)
    return mapa
  }, [variaveisPendentes])

  /** A lista confirmada com as ações em andamento aplicadas por cima. */
  const sobrepor = useCallback(
    (itens: Incidente[]) =>
      pendentes.size === 0
        ? itens
        : itens.map((item) => {
            const acao = pendentes.get(item.id)
            return acao ? aplicarAcao(item, acao, analista) : item
          }),
    [pendentes, analista],
  )

  return {
    executar,
    pendentes,
    sobrepor,
    conflitos,
    dispensarConflito,
    avisos,
    fecharAviso,
    anuncio,
  }
}
