import { useLayoutEffect, useRef } from 'react'
import { LogosLoader } from './LogosLoader'

const DURACAO_VOO_MS = 300

/**
 * Transição pós-login: cobre a tela por um ciclo do loader enquanto a lista começa a carregar.
 * Na saída, o fundo some e o desenho do loader encolhe e voa até a marca do cabeçalho da
 * triagem (técnica FLIP, sem biblioteca): fica a sensação de que "a central abriu".
 */
export function TelaAbertura({ saindo }: { saindo: boolean }) {
  const caixa = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    if (!saindo) return
    const desenho = caixa.current?.querySelector<SVGSVGElement>('svg')
    const alvo = document.querySelector('[data-marca-logos]')
    if (!desenho || !alvo) return
    const origem = desenho.getBoundingClientRect()
    const destino = alvo.getBoundingClientRect()
    if (!origem.width) return
    const dx = destino.left + destino.width / 2 - (origem.left + origem.width / 2)
    const dy = destino.top + destino.height / 2 - (origem.top + origem.height / 2)
    desenho.style.transition = `transform ${DURACAO_VOO_MS}ms cubic-bezier(0.16, 1, 0.3, 1)`
    desenho.style.transform = `translate(${dx}px, ${dy}px) scale(${destino.width / origem.width})`
    // A legenda e o letreiro do loader somem; só o desenho viaja.
    for (const irmao of desenho.parentElement?.children ?? []) {
      if (irmao === desenho || !(irmao instanceof HTMLElement || irmao instanceof SVGElement))
        continue
      irmao.style.transition = `opacity ${DURACAO_VOO_MS / 2}ms`
      irmao.style.opacity = '0'
    }
  }, [saindo])

  return (
    <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center">
      <div
        aria-hidden
        className={
          'pointer-events-auto absolute inset-0 bg-background transition-opacity duration-300 ' +
          (saindo ? 'pointer-events-none opacity-0' : 'opacity-100')
        }
      />
      <div ref={caixa} className="relative">
        <LogosLoader tamanho={88} legenda="Abrindo a central…" />
      </div>
    </div>
  )
}
