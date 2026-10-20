import { QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { encerrarSessao, lerSessao } from '@/api/sessao'
import { criarClienteDeConsultas } from '@/lib/consultas'
import { TelaLogin } from './TelaLogin'

const ANA = { id: 1, nome: 'Ana Souza', usuario: 'ana' }

function respostaJson(status: number, corpo: unknown) {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function erroDaApi(status: number, codigo: string) {
  return respostaJson(status, { erro: { codigo, mensagem: codigo } })
}

const nunca = () => new Promise<Response>(() => {})

/** fetch falso: `/health` e `/auth/login` respondem com o que cada teste definir. */
function simularApi(rotas: { saude?: () => Promise<Response>; login?: () => Promise<Response> }) {
  const fetchFalso = vi.fn<typeof fetch>((entrada) => {
    const url = String(entrada)
    if (url.endsWith('/health')) {
      return rotas.saude?.() ?? Promise.resolve(respostaJson(200, { status: 'ok', banco: 'ok' }))
    }
    if (url.endsWith('/auth/login')) return rotas.login?.() ?? nunca()
    return nunca()
  })
  vi.stubGlobal('fetch', fetchFalso)
  return fetchFalso
}

function chamadasDeLogin(fetchFalso: ReturnType<typeof simularApi>) {
  return fetchFalso.mock.calls.filter(([url]) => String(url).endsWith('/auth/login'))
}

function renderizar() {
  const cliente = criarClienteDeConsultas()
  cliente.setDefaultOptions({ queries: { retry: false } })
  const aoEntrar = vi.fn()
  render(
    <QueryClientProvider client={cliente}>
      <TelaLogin aoEntrar={aoEntrar} />
    </QueryClientProvider>,
  )
  return { aoEntrar }
}

beforeEach(() => encerrarSessao())
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('TelaLogin', () => {
  it('mostra as credenciais de demonstração e preenche o formulário', async () => {
    simularApi({})
    renderizar()

    expect(screen.getByText('logos2026')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Preencher' }))

    expect(screen.getByLabelText('Usuário')).toHaveValue('ana')
    expect(screen.getByLabelText('Senha')).toHaveValue('logos2026')
  })

  it('pede os campos vazios sem chamar a API', async () => {
    const fetchFalso = simularApi({})
    renderizar()

    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }))

    expect(screen.getByRole('alert')).toHaveTextContent('Preencha o usuário e a senha.')
    expect(chamadasDeLogin(fetchFalso)).toHaveLength(0)
  })

  it('o cartão treme uma vez com o erro e para no fim da animação', async () => {
    simularApi({})
    renderizar()

    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }))
    const titulo = screen.getByRole('heading', { name: 'Entrar na central' })
    const cartao = titulo.closest('.animate-tremer')
    expect(cartao).not.toBeNull()
    // Quem treme não pode ser filho de uma cascata: ao parar, a entrada recomeçaria.
    expect(cartao!.parentElement).not.toHaveClass('cascata')

    // O jsdom não tem AnimationEvent, e o React escuta a versão prefixada do fim da animação.
    fireEvent(cartao!, new Event('webkitAnimationEnd', { bubbles: true }))
    expect(cartao).not.toHaveClass('animate-tremer')
  })

  it('entra com as credenciais certas e guarda a sessão', async () => {
    simularApi({
      login: async () =>
        respostaJson(200, {
          token: 'jwt',
          expira_em: new Date(Date.now() + 3_600_000).toISOString(),
          analista: ANA,
        }),
    })
    const { aoEntrar } = renderizar()

    await userEvent.click(screen.getByRole('button', { name: 'Preencher' }))
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }))

    await vi.waitFor(() => expect(aoEntrar).toHaveBeenCalled())
    expect(aoEntrar.mock.calls[0][0]).toEqual(ANA)
    expect(lerSessao()?.token).toBe('jwt')
  })

  it.each([
    [401, 'credenciais_invalidas', 'Usuário ou senha incorretos.'],
    [429, 'muitas_tentativas', 'Aguarde 1 minuto'],
    [503, 'servico_indisponivel', 'O servidor não respondeu.'],
  ])('explica a falha %i (%s)', async (status, codigo, trecho) => {
    simularApi({ login: async () => erroDaApi(status, codigo) })
    renderizar()

    await userEvent.type(screen.getByLabelText('Usuário'), 'ana')
    await userEvent.type(screen.getByLabelText('Senha'), 'errada')
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(trecho)
  })

  it('apaga o aviso de erro quando o analista volta a digitar', async () => {
    simularApi({ login: async () => erroDaApi(401, 'credenciais_invalidas') })
    renderizar()

    await userEvent.type(screen.getByLabelText('Usuário'), 'ana')
    await userEvent.type(screen.getByLabelText('Senha'), 'x')
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }))
    await screen.findByRole('alert')

    await userEvent.type(screen.getByLabelText('Senha'), 'y')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('envia uma tentativa só, mesmo com o login pendente', async () => {
    const fetchFalso = simularApi({ login: nunca })
    renderizar()

    await userEvent.click(screen.getByRole('button', { name: 'Preencher' }))
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }))
    // O botão já está desativado; o envio direto do formulário testa a guarda do próprio envio.
    fireEvent.submit(screen.getByLabelText('Senha').closest('form')!)
    // A mutação chama o fetch de forma assíncrona: espera as tarefas pendentes antes de contar.
    await act(async () => {})

    expect(screen.getByRole('button', { name: /Entrando/ })).toBeDisabled()
    expect(chamadasDeLogin(fetchFalso)).toHaveLength(1)
  })

  it('avisa que o servidor está acordando quando a chamada de saúde demora', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    simularApi({ saude: nunca })
    renderizar()

    expect(screen.queryByText('Acordando o servidor…')).not.toBeInTheDocument()
    await act(() => vi.advanceTimersByTimeAsync(3_000))

    expect(screen.getByRole('status')).toHaveTextContent('Acordando o servidor…')
    expect(screen.getByText(/Aguardando há \d+ s/)).toBeInTheDocument()
  })

  it('avisa durante um login lento e some quando a resposta chega', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    let responderLogin: (resposta: Response) => void = () => {}
    simularApi({ login: () => new Promise((resolver) => (responderLogin = resolver)) })
    renderizar()

    await userEvent.click(screen.getByRole('button', { name: 'Preencher' }))
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }))
    await act(() => vi.advanceTimersByTimeAsync(3_000))
    expect(screen.getByText('Acordando o servidor…')).toBeInTheDocument()

    await act(async () => responderLogin(erroDaApi(401, 'credenciais_invalidas')))

    expect(await screen.findByRole('alert')).toHaveTextContent('Usuário ou senha incorretos.')
    expect(screen.queryByText('Acordando o servidor…')).not.toBeInTheDocument()
  })
})
