// Tema claro/escuro. A classe `dark` no <html> troca todos os tokens de src/index.css.
// O index.html aplica o tema salvo antes do React carregar, para a tela não piscar em branco.

import { flushSync } from 'react-dom'

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

/** Ponto da tela (ex.: centro do botão) de onde a troca de tema se espalha. */
export interface Origem {
  x: number
  y: number
}

const DURACAO_CIRCULO_MS = 500

/**
 * Troca em círculo crescendo a partir do botão (View Transitions API). O navegador tira uma
 * foto da tela, aplica o tema e revela a tela nova pelo círculo. Sem a API ou com menos
 * movimento, cai na transição de cores comum.
 */
function revelarEmCirculo(tema: Tema, { x, y }: Origem): boolean {
  const semMovimento = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  if (semMovimento || typeof document.startViewTransition !== 'function') return false
  const raiz = document.documentElement
  const transicao = document.startViewTransition(() => {
    // A View Transition já mistura as duas telas: as transições de cor de cada componente
    // atrasariam o texto em relação ao fundo (contraste baixo por um instante).
    raiz.classList.add('tema-instantaneo')
    // flushSync: o React redesenha o ícone do botão antes da foto da tela nova. Esperar um
    // quadro (requestAnimationFrame) não serve: a renderização fica suspensa durante esta
    // função, e a transição só terminaria pelo tempo limite.
    flushSync(() => aplicarTema(tema))
  })
  const raio = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y))
  transicao.ready
    .then(() => {
      document.documentElement.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${raio}px at ${x}px ${y}px)`] },
        {
          duration: DURACAO_CIRCULO_MS,
          easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
          pseudoElement: '::view-transition-new(root)',
        },
      )
    })
    .catch(() => {}) // transição pulada (ex.: outra começou): o tema já foi aplicado
  transicao.finished.finally(() => raiz.classList.remove('tema-instantaneo'))
  return true
}

/** Troca o tema por ação do analista: anima a troca e guarda a escolha. */
export function definirTema(tema: Tema, origem?: Origem): void {
  if (!origem || !revelarEmCirculo(tema, origem)) trocarComTransicao(tema)
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
