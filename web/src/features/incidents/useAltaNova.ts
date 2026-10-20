import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Incidente } from '@/api/tipos'

// Gestão por exceção: um incidente Alta novo entra no fim do grupo Alta (o mais antigo vem
// primeiro) e pode ficar fora da tela. Este hook compara cada leitura com a anterior e aponta
// os Alta que apareceram — incidente novo ou que subiu para Alta —, para a tela avisar.
//
// Recebe a lista CONFIRMADA pela API, sem a atualização otimista por cima: senão, fechar um
// Alta e ver a ação falhar faria ele "reaparecer" como Alta novo.

export const DURACAO_DESTAQUE_MS = 15_000

export interface AvisoAltaNova {
  /** Ids na ordem em que chegaram, só os ainda Alta ativos; o primeiro é o alvo do "Ver". */
  ids: number[]
  /** Título do primeiro, para o texto do aviso. */
  titulo: string
}

function altaAtivos(itens: Incidente[]): Set<number> {
  return new Set(
    itens.filter((i) => i.criticidade === 'alta' && i.status !== 'fechado').map((i) => i.id),
  )
}

/**
 * @param itens a lista atual (undefined antes da primeira leitura)
 * @param idAnalista quem está logado: o que ele mesmo criou ou mudou não gera aviso
 * @param tituloBase título da aba sem contagem
 */
export function useAltaNova(
  itens: Incidente[] | undefined,
  idAnalista: number,
  tituloBase: string,
) {
  // Alta ativos da leitura anterior; null até a primeira leitura (que nunca gera aviso).
  const conhecidos = useRef<Set<number> | null>(null)
  const [destaques, setDestaques] = useState<ReadonlySet<number>>(() => new Set())
  const [idsAviso, setIdsAviso] = useState<number[]>([])
  const [anuncio, setAnuncio] = useState('')
  // O anúncio é limpo depois de alguns segundos: o mesmo texto repetido mais tarde (ex.: o
  // mesmo incidente voltando a Alta) precisa mudar a região viva para ser lido de novo.
  const limparAnuncio = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  // Alta novos que chegaram com a aba em segundo plano: vão para o título da aba.
  const [naoVistos, setNaoVistos] = useState(0)
  // Um temporizador por leitura com novidade. Fora do efeito: a próxima leitura (5 s depois)
  // não pode cancelar o fim de um destaque anterior.
  const temporizadores = useRef(new Set<ReturnType<typeof setTimeout>>())
  useEffect(() => {
    const ativos = temporizadores.current
    return () => {
      ativos.forEach(clearTimeout)
      clearTimeout(limparAnuncio.current)
    }
  }, [])

  useEffect(() => {
    if (!itens) return
    const atuais = altaAtivos(itens)
    const anteriores = conhecidos.current
    conhecidos.current = atuais
    if (!anteriores) return

    const novos = itens.filter(
      (i) => atuais.has(i.id) && !anteriores.has(i.id) && i.atualizado_por?.id !== idAnalista,
    )
    if (novos.length === 0) return

    const ids = novos.map((i) => i.id)
    setDestaques((atual) => new Set([...atual, ...ids]))
    setIdsAviso((atual) => [...atual, ...ids.filter((id) => !atual.includes(id))])
    clearTimeout(limparAnuncio.current)
    limparAnuncio.current = setTimeout(() => setAnuncio(''), 7_000)
    setAnuncio(
      novos.length === 1
        ? `Novo incidente Alta: #${novos[0].id}, ${novos[0].titulo}.`
        : `${novos.length} novos incidentes Alta: ${ids.map((id) => `#${id}`).join(', ')}.`,
    )
    if (document.hidden) setNaoVistos((n) => n + novos.length)

    const timer = setTimeout(() => {
      temporizadores.current.delete(timer)
      setDestaques((atual) => {
        const restantes = new Set(atual)
        ids.forEach((id) => restantes.delete(id))
        return restantes
      })
    }, DURACAO_DESTAQUE_MS)
    temporizadores.current.add(timer)
  }, [itens, idAnalista])

  // Contagem no título da aba enquanto o analista está em outra aba; zera quando ele volta.
  useEffect(() => {
    document.title = naoVistos > 0 ? `(${naoVistos}) ${tituloBase}` : tituloBase
  }, [naoVistos, tituloBase])
  useEffect(() => {
    const aoMudarVisibilidade = () => {
      if (!document.hidden) setNaoVistos(0)
    }
    document.addEventListener('visibilitychange', aoMudarVisibilidade)
    return () => {
      document.removeEventListener('visibilitychange', aoMudarVisibilidade)
      document.title = tituloBase
    }
  }, [tituloBase])

  // O aviso mostra só quem ainda é Alta ativo: um incidente fechado ou removido depois de
  // chegar não tem mais o que "Ver".
  const aviso = useMemo<AvisoAltaNova | null>(() => {
    if (!itens || idsAviso.length === 0) return null
    const ativos = altaAtivos(itens)
    const ids = idsAviso.filter((id) => ativos.has(id))
    const primeiro = itens.find((i) => i.id === ids[0])
    return primeiro ? { ids, titulo: primeiro.titulo } : null
  }, [itens, idsAviso])

  /** Sem id, fecha o aviso; com id, tira só esse incidente (o "Ver" passa para o próximo). */
  const dispensar = useCallback((id?: number) => {
    setIdsAviso((atual) => (id === undefined ? [] : atual.filter((x) => x !== id)))
  }, [])

  return { destaques, aviso, anuncio, dispensar }
}
