import type { AnalistaLogado } from './tipos'

// O token fica no localStorage (risco aceito no MVP, ver docs/decisoes/0005-seguranca.md).
// Todo acesso fica em try/catch: em aba anônima ou com armazenamento bloqueado, o
// localStorage lança erro, e o app deve continuar funcionando (a sessão só não persiste).

const CHAVE = 'logos.sessao'

export interface SessaoSalva {
  token: string
  expiraEm: string
  analista: AnalistaLogado
}

let sessaoEmMemoria: SessaoSalva | null = null
const ouvintesDeExpiracao = new Set<() => void>()

export function lerSessao(): SessaoSalva | null {
  if (sessaoEmMemoria) return sessaoEmMemoria
  try {
    const bruto = localStorage.getItem(CHAVE)
    if (!bruto) return null
    const sessao = JSON.parse(bruto) as SessaoSalva
    if (new Date(sessao.expiraEm).getTime() <= Date.now()) {
      localStorage.removeItem(CHAVE)
      return null
    }
    sessaoEmMemoria = sessao
    return sessao
  } catch {
    return null
  }
}

export function salvarSessao(sessao: SessaoSalva): void {
  sessaoEmMemoria = sessao
  try {
    localStorage.setItem(CHAVE, JSON.stringify(sessao))
  } catch {
    // Sem armazenamento: a sessão vale só enquanto a aba estiver aberta.
  }
}

export function encerrarSessao(): void {
  sessaoEmMemoria = null
  try {
    localStorage.removeItem(CHAVE)
  } catch {
    // Nada a limpar.
  }
}

/** Avisa quando a API recusa o token (expirado ou inválido). Devolve a função de remoção. */
export function aoExpirarSessao(ouvinte: () => void): () => void {
  ouvintesDeExpiracao.add(ouvinte)
  return () => ouvintesDeExpiracao.delete(ouvinte)
}

export function notificarSessaoExpirada(): void {
  encerrarSessao()
  ouvintesDeExpiracao.forEach((ouvinte) => ouvinte())
}
