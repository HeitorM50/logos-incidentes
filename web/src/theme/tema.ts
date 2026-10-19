// Tema claro/escuro. A classe `dark` no <html> troca todos os tokens de src/index.css.
// O index.html aplica o tema salvo antes do React carregar, para a tela não piscar em branco.

export type Tema = 'claro' | 'escuro'

const CHAVE = 'logos.tema'
const DURACAO_TRANSICAO_MS = 300

const ouvintes = new Set<() => void>()

export function lerTema(): Tema {
  return document.documentElement.classList.contains('dark') ? 'escuro' : 'claro'
}

export function aplicarTema(tema: Tema): void {
  document.documentElement.classList.toggle('dark', tema === 'escuro')
  ouvintes.forEach((ouvinte) => ouvinte())
}

let temporizador: ReturnType<typeof setTimeout> | undefined

function trocarComTransicao(tema: Tema): void {
  const raiz = document.documentElement
  raiz.classList.add('tema-em-transicao')
  aplicarTema(tema)
  clearTimeout(temporizador)
  temporizador = setTimeout(() => raiz.classList.remove('tema-em-transicao'), DURACAO_TRANSICAO_MS)
}

function temaSalvo(): string | null {
  try {
    return localStorage.getItem(CHAVE)
  } catch {
    return null
  }
}

/** Troca o tema por ação do analista: anima a troca e guarda a escolha. */
export function definirTema(tema: Tema): void {
  trocarComTransicao(tema)
  try {
    localStorage.setItem(CHAVE, tema)
  } catch {
    // Sem armazenamento: a escolha vale só nesta aba.
  }
}

export function aoMudarTema(ouvinte: () => void): () => void {
  ouvintes.add(ouvinte)
  return () => ouvintes.delete(ouvinte)
}

/**
 * Sem escolha salva, o tema acompanha o sistema operacional também com o app aberto (ex.: o
 * modo escuro automático ao anoitecer). Depois que o analista escolhe, a escolha prevalece.
 */
export function seguirTemaDoSistema(): () => void {
  const consulta = window.matchMedia?.('(prefers-color-scheme: dark)')
  if (!consulta) return () => {}
  const aoMudar = (evento: MediaQueryListEvent) => {
    if (temaSalvo() === null) trocarComTransicao(evento.matches ? 'escuro' : 'claro')
  }
  consulta.addEventListener('change', aoMudar)
  return () => consulta.removeEventListener('change', aoMudar)
}
