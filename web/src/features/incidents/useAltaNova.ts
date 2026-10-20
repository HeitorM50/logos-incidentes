import { useCallback, useEffect, useRef, useState } from 'react'
import type { Incidente } from '@/api/tipos'

// Gestão por exceção: um incidente Alta novo entra no fim do grupo Alta (o mais antigo vem
// primeiro) e pode ficar fora da tela. Este hook compara cada leitura com a anterior e aponta
// os Alta que apareceram — incidente novo ou que subiu para Alta —, para a tela avisar.

export const DURACAO_DESTAQUE_MS = 15_000

export interface AvisoAltaNova {
  /** Ids na ordem em que chegaram; o primeiro é o alvo do botão "Ver". */
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
  const [aviso, setAviso] = useState<AvisoAltaNova | null>(null)
  const [anuncio, setAnuncio] = useState('')
  // Alta novos que chegaram com a aba em segundo plano: vão para o título da aba.
  const [naoVistos, setNaoVistos] = useState(0)
  // Um temporizador por leitura com novidade. Fora do efeito: a próxima leitura (5 s depois)
  // não pode cancelar o fim de um destaque anterior.
  const temporizadores = useRef(new Set<ReturnType<typeof setTimeout>>())
  useEffect(() => {
    const ativos = temporizadores.current
    return () => ativos.forEach(clearTimeout)
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
    setAviso((atual) => {
      const todos = [...(atual?.ids ?? []), ...ids.filter((id) => !atual?.ids.includes(id))]
      return { ids: todos, titulo: atual?.titulo ?? novos[0].titulo }
    })
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

  const dispensar = useCallback(() => setAviso(null), [])

  return { destaques, aviso, anuncio, dispensar }
}
