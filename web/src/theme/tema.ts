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

/** Troca o tema por ação do analista: anima a troca e guarda a escolha. */
export function definirTema(tema: Tema): void {
  const raiz = document.documentElement
  raiz.classList.add('tema-em-transicao')
  aplicarTema(tema)
  clearTimeout(temporizador)
  temporizador = setTimeout(() => raiz.classList.remove('tema-em-transicao'), DURACAO_TRANSICAO_MS)
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
