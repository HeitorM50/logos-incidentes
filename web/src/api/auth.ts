import { requisitar } from './cliente'
import { salvarSessao } from './sessao'
import type { AnalistaLogado, TokenAcesso } from './tipos'

export async function entrar(usuario: string, senha: string): Promise<AnalistaLogado> {
  const resposta = await requisitar<TokenAcesso>('/auth/login', {
    metodo: 'POST',
    corpo: { usuario, senha },
    autenticada: false,
  })
  salvarSessao({
    token: resposta.token,
    expiraEm: resposta.expira_em,
    analista: resposta.analista,
  })
  return resposta.analista
}

export function buscarAnalistaAtual(sinal?: AbortSignal): Promise<AnalistaLogado> {
  return requisitar('/auth/eu', { sinal })
}
