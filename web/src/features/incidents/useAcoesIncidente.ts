import { useMutation, useMutationState, useQueryClient } from '@tanstack/react-query'
import { useCallback, useMemo, useRef, useState } from 'react'
import { ehErroApi } from '@/api/erros'
import { assumirIncidente, liberarIncidente, mudarStatus } from '@/api/incidentes'
import { ROTULO_STATUS } from '@/api/rotulos'
import type { AnalistaResumo, Incidente } from '@/api/tipos'
import {
  acoesParaDesfazer,
  anuncioPendente,
  aplicarAcao,
  descreverEstado,
  motivoBloqueio,
  nomeDaAcao,
  type Acao,
} from './acoes'
import { gravarVersao, relerLista, removerDaLista } from './cacheIncidentes'
import { CHAVE_ACAO_INCIDENTE } from './useIncidentes'

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
  /** Passo de um "Desfazer" (não oferece desfazer de novo). */
  desfazendo?: { passo: number; total: number }
}

/** 409: outro analista alterou o incidente antes. A linha já mostra a versão atual. */
export interface Conflito {
  acao: Acao
  /** Versão que a API devolveu no 409: se a linha mudar de novo, o aviso deixa de valer. */
  versao: number
  /** Nome de quem alterou; null quando a API não informa. */
  autor: string | null
}

/** Última ação confirmada que ainda pode ser desfeita ("Desfazer" por alguns segundos). */
export interface UltimaAcao {
  id: number
  /** Versão que a ação gerou: se o incidente mudar depois, o desfazer deixa de valer. */
  versao: number
  texto: string
  passos: Acao[]
  chave: number
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

/**
 * Falha num passo do "Desfazer". No primeiro passo nada mudou; depois dele, o incidente ficou
 * num estado intermediário, e o aviso diz qual é e o que falta (o "Tentar de novo" refaz só
 * o passo que faltou, porque é o último).
 */
function avisoDoDesfazer(erro: unknown, variaveis: Variaveis, idAnalista: number): AvisoFalha {
  const { incidente, acao, desfazendo } = variaveis
  const { passo, total } = desfazendo!
  const transitorio = ehErroApi(erro) && erro.ehTransitorio
  const base = { id: incidente.id, versao: incidente.versao, acao }
  const motivoApi = ehErroApi(erro) && !transitorio ? ` ${erro.message}` : ''
  if (passo === 0) {
    return {
      ...base,
      titulo: `Não foi possível desfazer em #${incidente.id}.`,
      detalhe:
        `Nada mudou: o incidente continua ${descreverEstado(incidente, idAnalista)}.` +
        (transitorio ? ' Verifique a conexão.' : motivoApi),
      podeRepetir: transitorio && total === 1,
    }
  }
  return {
    ...base,
    titulo: `Desfazer incompleto em #${incidente.id}.`,
    detalhe:
      `Ficou ${descreverEstado(incidente, idAnalista)}; ` +
      `falta ${nomeDaAcao(acao).toLowerCase()}.` +
      (transitorio ? ' Verifique a conexão e tente de novo.' : motivoApi),
    podeRepetir: transitorio && passo === total - 1,
  }
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
  const [ultima, setUltima] = useState<UltimaAcao | null>(null)
  // Incidentes no meio de um "Desfazer" de vários passos: entre um passo e outro a guarda
  // emAndamento fica vazia, e um clique ali intercalaria uma ação no meio da sequência.
  const desfazendoIds = useRef(new Set<number>())

  const { mutate, mutateAsync } = useMutation({
    mutationKey: CHAVE_ACAO_INCIDENTE,
    mutationFn: chamarApi,
    onSuccess: (novo, { incidente, acao, desfazendo }) => {
      gravarVersao(cliente, novo)
      if (desfazendo) {
        // Só o último passo anuncia: no meio, o incidente ainda não voltou ao estado de antes.
        if (desfazendo.passo === desfazendo.total - 1) {
          setAnuncio(`Ação desfeita: #${novo.id} está ${descreverEstado(novo, analista.id)}.`)
        }
        return
      }
      const texto = textoSucesso(acao, novo)
      const passos = acoesParaDesfazer(incidente, acao)
      setAnuncio(passos ? `${texto} Para desfazer, Ctrl+Z.` : texto)
      setUltima(
        passos ? { id: novo.id, versao: novo.versao, texto, passos, chave: Date.now() } : null,
      )
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
      const aviso = variaveis.desfazendo
        ? avisoDoDesfazer(erro, variaveis, analista.id)
        : montarAviso(erro, variaveis, analista.id)
      setAvisos((todos) => [...todos.filter((a) => a.id !== aviso.id), aviso])
    },
    onSettled: (_dados, _erro, { incidente }) => {
      emAndamento.current.delete(incidente.id)
      void relerLista(cliente)
    },
  })

  const fecharAviso = useCallback((id: number) => {
    setAvisos((todos) => todos.filter((a) => a.id !== id))
  }, [])

  const executar = useCallback(
    (incidente: Incidente, acao: Acao) => {
      if (emAndamento.current.has(incidente.id) || desfazendoIds.current.has(incidente.id)) return
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

  /**
   * Desfaz a última ação com ações novas (versão atual, mesmas regras). Os passos rodam em
   * sequência: cada um parte da versão que o anterior gravou.
   */
  const desfazer = useCallback(
    async (incidente: Incidente) => {
      const alvo = ultima
      if (!alvo || alvo.id !== incidente.id || alvo.versao !== incidente.versao) return
      // Com outra ação do mesmo incidente em voo, o clique não some em silêncio: o aviso
      // continua (a tela o esconde enquanto houver pendência).
      if (emAndamento.current.has(incidente.id)) return
      setUltima(null)
      setConflitos((todos) => semChave(todos, incidente.id))
      fecharAviso(incidente.id)
      desfazendoIds.current.add(incidente.id)
      setAnuncio(`Desfazendo a ação em #${incidente.id}…`)
      let atual = incidente
      try {
        for (const [i, passo] of alvo.passos.entries()) {
          const motivo = motivoBloqueio(atual, passo, analista.id)
          if (motivo) {
            const aviso: AvisoFalha = {
              id: atual.id,
              versao: atual.versao,
              acao: passo,
              titulo:
                i === 0
                  ? `Não foi possível desfazer em #${atual.id}.`
                  : `Desfazer incompleto em #${atual.id}.`,
              detalhe: motivo,
              podeRepetir: false,
            }
            setAvisos((todos) => [...todos.filter((a) => a.id !== aviso.id), aviso])
            return
          }
          emAndamento.current.add(atual.id)
          try {
            atual = await mutateAsync({
              incidente: atual,
              acao: passo,
              desfazendo: { passo: i, total: alvo.passos.length },
            })
          } catch {
            return // onError já mostrou o conflito ou a falha (avisoDoDesfazer)
          }
        }
      } finally {
        desfazendoIds.current.delete(incidente.id)
      }
    },
    [ultima, mutateAsync, analista.id, fecharAviso],
  )

  const dispensarUltima = useCallback(() => setUltima(null), [])

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
    ultima,
    desfazer,
    dispensarUltima,
  }
}
