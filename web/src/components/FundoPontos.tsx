import { useEffect, useRef } from 'react'
import { aoMudarTema } from '@/theme/tema'

// Fundo animado do login: grade de pontos que surge do centro e cintila devagar.
// Desenhado em Canvas 2D, sem biblioteca 3D: são poucos milhares de quadrados por quadro.

const ESPACO_PX = 18
const PONTO_PX = 3
const INTENSIDADE = 0.28
// Cada ponto sorteia um destes níveis de opacidade a cada PERIODO_S segundos.
const NIVEIS = [0.3, 0.3, 0.3, 0.5, 0.5, 0.5, 0.8, 0.8, 0.8, 1]
const PERIODO_S = 5
const ATRASO_POR_CELULA_S = 0.012
const DURACAO_ENTRADA_S = 1.4
// Depois da entrada, os pontos só mudam a cada poucos segundos: 20 quadros por segundo bastam.
const INTERVALO_QUADRO_MS = 50

/** Número pseudoaleatório estável em [0, 1) para a mesma célula e semente. */
function aleatorio(x: number, y: number, semente: number): number {
  const v = Math.sin(x * 127.1 + y * 311.7 + semente * 74.7) * 43758.5453
  return v - Math.floor(v)
}

interface Props {
  /** Cor da vinheta que acalma o centro (padrão: o fundo da página). */
  vinheta?: string
}

export function FundoPontos({ vinheta = 'var(--background)' }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const contexto = canvas?.getContext('2d')
    if (!canvas || !contexto) return

    const semMovimento = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
    let cor = ''
    let largura = 0
    let altura = 0
    let quadro = 0
    let ultimoDesenho = 0
    const inicio = performance.now()

    const lerCor = () => {
      cor = getComputedStyle(canvas).getPropertyValue('--pontos').trim() || '#888'
    }

    const ajustarTamanho = () => {
      const densidade = window.devicePixelRatio || 1
      largura = canvas.clientWidth
      altura = canvas.clientHeight
      canvas.width = Math.round(largura * densidade)
      canvas.height = Math.round(altura * densidade)
      contexto.setTransform(densidade, 0, 0, densidade, 0, 0)
    }

    const desenhar = (segundos: number) => {
      contexto.clearRect(0, 0, largura, altura)
      contexto.fillStyle = cor
      const colunas = Math.ceil(largura / ESPACO_PX)
      const linhas = Math.ceil(altura / ESPACO_PX)
      const centroX = colunas / 2
      const centroY = linhas / 2
      const margemX = (largura - colunas * ESPACO_PX + ESPACO_PX - PONTO_PX) / 2
      const margemY = (altura - linhas * ESPACO_PX + ESPACO_PX - PONTO_PX) / 2

      for (let y = 0; y < linhas; y++) {
        for (let x = 0; x < colunas; x++) {
          const deslocamento = aleatorio(x, y, 1)
          const atraso =
            Math.hypot(x - centroX, y - centroY) * ATRASO_POR_CELULA_S + deslocamento * 0.15
          if (segundos < atraso) continue

          const ciclo = Math.floor(segundos / PERIODO_S + deslocamento)
          const nivel = NIVEIS[Math.floor(aleatorio(x, y, ciclo + 2) * NIVEIS.length)]
          // O ponto acende mais forte no instante em que surge e assenta no nível sorteado.
          const brilhoDeEntrada = segundos - atraso < 0.1 ? 1.25 : 1
          contexto.globalAlpha = Math.min(1, nivel * brilhoDeEntrada) * INTENSIDADE
          contexto.fillRect(margemX + x * ESPACO_PX, margemY + y * ESPACO_PX, PONTO_PX, PONTO_PX)
        }
      }
      contexto.globalAlpha = 1
    }

    const animar = (agora: number) => {
      quadro = requestAnimationFrame(animar)
      const segundos = (agora - inicio) / 1000
      const naEntrada = segundos < DURACAO_ENTRADA_S
      if (!naEntrada && agora - ultimoDesenho < INTERVALO_QUADRO_MS) return
      ultimoDesenho = agora
      desenhar(segundos)
    }

    // Sem animação, desenha um quadro fixo com todos os pontos já visíveis.
    const desenharEstatico = () => desenhar(DURACAO_ENTRADA_S + PERIODO_S)

    lerCor()
    ajustarTamanho()
    if (semMovimento) desenharEstatico()
    else quadro = requestAnimationFrame(animar)

    // Mudar o tamanho do canvas apaga o desenho: redesenha na hora para não piscar.
    const aoRedimensionar = () => {
      ajustarTamanho()
      if (semMovimento) desenharEstatico()
      else desenhar((performance.now() - inicio) / 1000)
    }
    window.addEventListener('resize', aoRedimensionar)
    const pararDeOuvirTema = aoMudarTema(() => {
      lerCor()
      if (semMovimento) desenharEstatico()
    })

    return () => {
      cancelAnimationFrame(quadro)
      window.removeEventListener('resize', aoRedimensionar)
      pararDeOuvirTema()
    }
  }, [])

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <canvas ref={canvasRef} className="size-full" />
      {/* Vinheta: o centro fica calmo para o formulário continuar legível. */}
      <div
        className="absolute inset-0"
        style={{ background: `radial-gradient(ellipse at center, ${vinheta} 15%, transparent 75%)` }}
      />
    </div>
  )
}
