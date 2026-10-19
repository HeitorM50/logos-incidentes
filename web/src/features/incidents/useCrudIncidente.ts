import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ehErroApi } from '@/api/erros'
import { criarIncidente, editarIncidente, removerIncidente } from '@/api/incidentes'
import type { Incidente, NovoIncidente } from '@/api/tipos'
import { gravarVersao, relerLista, removerDaLista } from './cacheIncidentes'

// Criar, editar e remover não são otimistas: o analista preenche um formulário e espera a
// confirmação da API no próprio painel. O cache só recebe o que a API confirmou.

interface Edicao {
  /** A versão que o formulário tomou como base; o PATCH envia a versão dela. */
  base: Incidente
  mudou: Partial<NovoIncidente>
}

/** 409 traz o estado atual (vai para a lista); 404 tira a linha. Vale para editar e remover. */
function tratarErroDeVersao(cliente: ReturnType<typeof useQueryClient>, erro: unknown, id: number) {
  if (!ehErroApi(erro)) return
  if (erro.ehConflito && erro.atual) gravarVersao(cliente, erro.atual)
  if (erro.codigo === 'nao_encontrado') removerDaLista(cliente, id)
}

export function useCrudIncidente() {
  const cliente = useQueryClient()

  const criar = useMutation({
    mutationFn: (dados: NovoIncidente) => criarIncidente(dados),
    onSettled: () => void relerLista(cliente),
  })

  const editar = useMutation({
    mutationFn: ({ base, mudou }: Edicao) =>
      editarIncidente(base.id, { ...mudou, versao: base.versao }),
    onSuccess: (novo) => gravarVersao(cliente, novo),
    onError: (erro, { base }) => tratarErroDeVersao(cliente, erro, base.id),
    onSettled: () => void relerLista(cliente),
  })

  const remover = useMutation({
    mutationFn: (incidente: Incidente) => removerIncidente(incidente.id, incidente.versao),
    onSuccess: (_vazio, incidente) => removerDaLista(cliente, incidente.id),
    onError: (erro, incidente) => tratarErroDeVersao(cliente, erro, incidente.id),
    onSettled: () => void relerLista(cliente),
  })

  return { criar, editar, remover }
}
