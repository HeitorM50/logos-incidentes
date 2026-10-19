import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { API_URL, requisitar } from './cliente'
import { ErroApi } from './erros'
import { aoExpirarSessao, encerrarSessao, lerSessao, salvarSessao } from './sessao'

function respostaJson(status: number, corpo: unknown, cabecalhos: Record<string, string> = {}) {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { 'Content-Type': 'application/json', ...cabecalhos },
  })
}

const fetchFalso = vi.fn<typeof fetch>()

beforeEach(() => {
  vi.stubGlobal('fetch', fetchFalso)
  salvarSessao({
    token: 'token-da-ana',
    expiraEm: new Date(Date.now() + 3_600_000).toISOString(),
    analista: { id: 1, nome: 'Ana Souza', usuario: 'ana' },
  })
})

afterEach(() => {
  fetchFalso.mockReset()
  vi.unstubAllGlobals()
  encerrarSessao()
})

function ultimaChamada() {
  const [url, init] = fetchFalso.mock.calls.at(-1)!
  return { url: String(url), init: init! }
}

async function capturarErro(promessa: Promise<unknown>): Promise<ErroApi> {
  try {
    await promessa
  } catch (erro) {
    expect(erro).toBeInstanceOf(ErroApi)
    return erro as ErroApi
  }
  throw new Error('a requisição deveria ter falhado')
}

describe('requisitar', () => {
  it('envia o token da sessão e monta parâmetros repetidos', async () => {
    fetchFalso.mockResolvedValue(respostaJson(200, { itens: [] }))

    await requisitar('/incidentes', { consulta: { criticidade: ['alta', 'media'], status: undefined } })

    const { url, init } = ultimaChamada()
    expect(url).toBe(`${API_URL}/incidentes?criticidade=alta&criticidade=media`)
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer token-da-ana')
  })

  it('envia o corpo em JSON nas escritas', async () => {
    fetchFalso.mockResolvedValue(respostaJson(200, {}))

    await requisitar('/incidentes/7/assumir', { metodo: 'POST', corpo: { versao: 3 } })

    const { init } = ultimaChamada()
    expect(init.method).toBe('POST')
    expect(init.body).toBe('{"versao":3}')
  })

  it('devolve undefined no 204', async () => {
    fetchFalso.mockResolvedValue(new Response(null, { status: 204 }))

    await expect(requisitar('/incidentes/7', { metodo: 'DELETE' })).resolves.toBeUndefined()
  })

  it('traduz o 422 com os campos inválidos', async () => {
    fetchFalso.mockResolvedValue(
      respostaJson(422, {
        erro: {
          codigo: 'validacao',
          mensagem: 'Dados inválidos.',
          campos: [{ campo: 'titulo', mensagem: 'muito curto' }],
        },
      }),
    )

    const erro = await capturarErro(requisitar('/incidentes', { metodo: 'POST', corpo: {} }))

    expect(erro.codigo).toBe('validacao')
    expect(erro.mensagemDoCampo('titulo')).toBe('muito curto')
    expect(erro.ehTransitorio).toBe(false)
  })

  it('traz o estado atual do incidente no 409', async () => {
    const atual = { id: 7, versao: 4, responsavel: { id: 2, nome: 'Bruno Lima' } }
    fetchFalso.mockResolvedValue(
      respostaJson(409, { erro: { codigo: 'ja_assumido', mensagem: 'Bruno Lima já assumiu.', atual } }),
    )

    const erro = await capturarErro(requisitar('/incidentes/7/assumir', { metodo: 'POST' }))

    expect(erro.ehConflito).toBe(true)
    expect(erro.atual).toEqual(atual)
    expect(erro.message).toBe('Bruno Lima já assumiu.')
  })

  it('encerra a sessão e avisa os ouvintes no 401', async () => {
    const ouvinte = vi.fn()
    const remover = aoExpirarSessao(ouvinte)
    fetchFalso.mockResolvedValue(
      respostaJson(401, { erro: { codigo: 'nao_autenticado', mensagem: 'Sessão expirada.' } }),
    )

    await capturarErro(requisitar('/incidentes'))
    remover()

    expect(ouvinte).toHaveBeenCalledOnce()
    expect(lerSessao()).toBeNull()
  })

  it('não trata 401 do login como sessão expirada', async () => {
    const ouvinte = vi.fn()
    const remover = aoExpirarSessao(ouvinte)
    fetchFalso.mockResolvedValue(
      respostaJson(401, { erro: { codigo: 'credenciais_invalidas', mensagem: 'Senha errada.' } }),
    )

    const erro = await capturarErro(requisitar('/auth/login', { metodo: 'POST', autenticada: false }))
    remover()

    expect(erro.codigo).toBe('credenciais_invalidas')
    expect(ouvinte).not.toHaveBeenCalled()
  })

  it('lê o Retry-After do 503 e marca como transitório', async () => {
    fetchFalso.mockResolvedValue(
      respostaJson(
        503,
        { erro: { codigo: 'servico_indisponivel', mensagem: 'Banco lento.' } },
        { 'Retry-After': '5' },
      ),
    )

    const erro = await capturarErro(requisitar('/incidentes'))

    expect(erro.tentarApos).toBe(5)
    expect(erro.ehTransitorio).toBe(true)
  })

  it('trata página HTML de erro do proxy como serviço indisponível', async () => {
    fetchFalso.mockResolvedValue(new Response('<html>Bad Gateway</html>', { status: 502 }))

    const erro = await capturarErro(requisitar('/incidentes'))

    expect(erro.codigo).toBe('servico_indisponivel')
    expect(erro.ehTransitorio).toBe(true)
  })

  it('transforma falha de rede em sem_conexao', async () => {
    fetchFalso.mockRejectedValue(new TypeError('Failed to fetch'))

    const erro = await capturarErro(requisitar('/incidentes'))

    expect(erro.codigo).toBe('sem_conexao')
    expect(erro.status).toBe(0)
    expect(erro.ehTransitorio).toBe(true)
  })

  it('repassa o cancelamento sem transformá-lo em erro de rede', async () => {
    const controle = new AbortController()
    controle.abort()
    fetchFalso.mockRejectedValue(new DOMException('cancelada', 'AbortError'))

    await expect(requisitar('/incidentes', { sinal: controle.signal })).rejects.toMatchObject({
      name: 'AbortError',
    })
  })

  it('transforma a demora acima do limite em falha passageira', async () => {
    // Simula o prazo já esgotado; o fetch real rejeitaria com o motivo do sinal.
    vi.spyOn(AbortSignal, 'timeout').mockReturnValue(
      AbortSignal.abort(new DOMException('prazo', 'TimeoutError')),
    )
    fetchFalso.mockRejectedValue(new DOMException('prazo', 'TimeoutError'))

    const erro = await capturarErro(requisitar('/incidentes'))

    expect(erro.codigo).toBe('sem_conexao')
    expect(erro.ehTransitorio).toBe(true)
    vi.restoreAllMocks()
  })
})
