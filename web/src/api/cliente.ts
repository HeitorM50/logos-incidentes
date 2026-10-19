import { type CodigoErro, ErroApi, type ErroDeCampo } from './erros'
import { lerSessao, notificarSessaoExpirada } from './sessao'
import type { Incidente } from './tipos'

export const API_URL = (import.meta.env.VITE_API_URL ?? 'http://localhost:8000').replace(/\/$/, '')

type Metodo = 'GET' | 'POST' | 'PATCH' | 'DELETE'
type ValorDeConsulta = string | number | readonly string[] | undefined

interface OpcoesRequisicao {
  metodo?: Metodo
  corpo?: unknown
  consulta?: Record<string, ValorDeConsulta>
  /** Cancela a requisição (o TanStack Query passa um sinal ao trocar de tela ou filtro). */
  sinal?: AbortSignal
  /** O login não manda token e não trata 401 como sessão expirada. */
  autenticada?: boolean
}

interface CorpoDeErro {
  erro?: {
    codigo?: CodigoErro
    mensagem?: string
    campos?: ErroDeCampo[]
    atual?: Incidente
  }
}

function montarUrl(caminho: string, consulta?: Record<string, ValorDeConsulta>): string {
  const url = new URL(`${API_URL}${caminho}`)
  for (const [chave, valor] of Object.entries(consulta ?? {})) {
    if (valor === undefined) continue
    // Parâmetros repetíveis viram ?criticidade=alta&criticidade=media
    for (const item of Array.isArray(valor) ? valor : [valor]) {
      url.searchParams.append(chave, String(item))
    }
  }
  return url.toString()
}

function lerTentarApos(resposta: Response): number | null {
  const segundos = Number(resposta.headers.get('Retry-After'))
  return Number.isFinite(segundos) && segundos > 0 ? segundos : null
}

async function erroDaResposta(resposta: Response): Promise<ErroApi> {
  const tentarApos = lerTentarApos(resposta)
  let corpo: CorpoDeErro | null = null
  try {
    corpo = (await resposta.json()) as CorpoDeErro
  } catch {
    // Ex.: página HTML de erro do proxy do Render durante um deploy.
  }
  const erro = corpo?.erro
  if (!erro?.codigo) {
    return new ErroApi({
      status: resposta.status,
      codigo: resposta.status >= 500 ? 'servico_indisponivel' : 'resposta_invalida',
      mensagem: 'O servidor respondeu de forma inesperada. Tente novamente.',
      tentarApos,
    })
  }
  return new ErroApi({
    status: resposta.status,
    codigo: erro.codigo,
    mensagem: erro.mensagem ?? 'Erro inesperado.',
    campos: erro.campos,
    atual: erro.atual,
    tentarApos,
  })
}

// Sem resposta neste prazo, a requisição vira falha passageira. Sem isto, uma conexão
// pendurada deixaria a tela "Ao vivo" para sempre e o polling nunca dispararia de novo.
// O prazo cobre o cold start do Render (~50 s): o servidor acordando ainda responde.
export const TEMPO_LIMITE_MS = 60_000

/** Único ponto do front que fala HTTP com a API. */
export async function requisitar<T>(caminho: string, opcoes: OpcoesRequisicao = {}): Promise<T> {
  const { metodo = 'GET', corpo, consulta, sinal, autenticada = true } = opcoes
  const cabecalhos: Record<string, string> = { Accept: 'application/json' }
  if (corpo !== undefined) cabecalhos['Content-Type'] = 'application/json'
  const sessao = autenticada ? lerSessao() : null
  if (sessao) cabecalhos.Authorization = `Bearer ${sessao.token}`

  const limite = AbortSignal.timeout(TEMPO_LIMITE_MS)
  let resposta: Response
  try {
    resposta = await fetch(montarUrl(caminho, consulta), {
      method: metodo,
      headers: cabecalhos,
      body: corpo === undefined ? undefined : JSON.stringify(corpo),
      signal: sinal ? AbortSignal.any([sinal, limite]) : limite,
    })
  } catch (falha) {
    // Cancelamento pedido pelo TanStack Query não é erro de rede: repassa para ele descartar.
    if (sinal?.aborted) throw falha
    if (limite.aborted) {
      throw new ErroApi({
        status: 0,
        codigo: 'sem_conexao',
        mensagem: 'O servidor demorou demais para responder. Vamos tentar de novo.',
      })
    }
    throw new ErroApi({
      status: 0,
      codigo: 'sem_conexao',
      mensagem: 'Sem conexão com o servidor. Verifique a internet; vamos tentar de novo.',
    })
  }

  if (!resposta.ok) {
    const erro = await erroDaResposta(resposta)
    if (erro.status === 401 && autenticada) notificarSessaoExpirada()
    throw erro
  }
  if (resposta.status === 204) return undefined as T
  try {
    return (await resposta.json()) as T
  } catch {
    throw new ErroApi({
      status: resposta.status,
      codigo: 'resposta_invalida',
      mensagem: 'O servidor respondeu de forma inesperada. Tente novamente.',
    })
  }
}
