import { useLayoutEffect, useRef, type RefObject } from 'react'

const DURACAO_MS = 250
// Saltos maiores que isso (ex.: trocar um filtro que esvazia meia lista) não animam: o olho
// não acompanha, e o movimento vira ruído.
const MAIOR_DESLOCAMENTO_PX = 600

/**
 * FLIP manual (First, Last, Invert, Play) para as linhas de uma lista: depois de cada render,
 * cada linha que mudou de posição sai do lugar antigo e desliza até o novo. Reordenação,
 * linha que some (as de baixo sobem) e detalhes que abrem (as de baixo descem) ficam
 * contínuos, e o analista acompanha para onde foi o incidente que acabou de mexer.
 *
 * Usa a Web Animations API (nativa), sem biblioteca. Com prefers-reduced-motion, não anima.
 */
export function useFlipLinhas(container: RefObject<HTMLElement | null>, seletor: string) {
  const posicoes = useRef(new Map<string, number>())

  useLayoutEffect(() => {
    const raiz = container.current
    if (!raiz) return
    const semMovimento = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    const novas = new Map<string, number>()
    for (const linha of raiz.querySelectorAll<HTMLElement>(seletor)) {
      const chave = linha.dataset.incidente
      if (!chave) continue
      const topo = linha.offsetTop
      novas.set(chave, topo)
      const antes = posicoes.current.get(chave)
      const delta = antes === undefined ? 0 : antes - topo
      if (
        delta === 0 ||
        semMovimento ||
        Math.abs(delta) > MAIOR_DESLOCAMENTO_PX ||
        typeof linha.animate !== 'function' // jsdom
      ) {
        continue
      }
      // Só o que está na janela: animar as linhas fora da tela gasta sem ninguém ver.
      const caixa = linha.getBoundingClientRect()
      if (caixa.bottom < 0 || caixa.top > window.innerHeight) continue
      linha.animate(
        [{ transform: `translateY(${delta}px)` }, { transform: 'translateY(0)' }],
        { duration: DURACAO_MS, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' },
      )
    }
    posicoes.current = novas
  })
}
