import { useEffect, useState } from 'react'

// Loader da marca Logos: contorno → preenchimento → recorte do L → varredura do letreiro.
// Ciclo de 2 s em SVG com <animate> (SMIL), sem biblioteca de animação. Substitui todo
// spinner genérico do app. Com prefers-reduced-motion, mostra a marca parada.
//
// As cores padrão são tokens do tema (src/index.css), então o loader acompanha o modo
// claro/escuro sem receber props. `fundo` precisa ser a cor real atrás do loader: o "L" é
// "recortado" pintando o traço com ela.

interface Props {
  /** Lado do quadrado em px. */
  tamanho?: number
  /** Cor da marca e do letreiro (valor CSS). */
  cor?: string
  /** Cor do fundo atrás do loader (valor CSS). */
  fundo?: string
  /** Mostra o letreiro LOGOS. Padrão: só a partir de 40 px. */
  letreiro?: boolean
  /** Texto abaixo da marca; também é o texto lido pelo leitor de tela. */
  legenda?: string
  /** Quando o texto ao lado já explica a espera: o loader vira só enfeite, sem anúncio. */
  decorativo?: boolean
  className?: string
}

const DURACAO = '2s'
const LETRAS = ['L', 'O', 'G', 'O', 'S']

function usePrefereMenosMovimento(): boolean {
  const [menos, setMenos] = useState(
    () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false,
  )
  useEffect(() => {
    const consulta = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    if (!consulta) return
    const aoMudar = (evento: MediaQueryListEvent) => setMenos(evento.matches)
    consulta.addEventListener('change', aoMudar)
    return () => consulta.removeEventListener('change', aoMudar)
  }, [])
  return menos
}

export function LogosLoader({
  tamanho = 64,
  cor = 'var(--foreground)',
  fundo = 'var(--background)',
  letreiro,
  legenda,
  decorativo = false,
  className,
}: Props) {
  const parado = usePrefereMenosMovimento()
  const mostrarLetreiro = letreiro ?? tamanho >= 40
  const larguraLetreiro = Math.round(tamanho * 1.5)

  // role="status" não tira o nome do conteúdo: o aria-label dá o nome, e o texto oculto é o
  // que o leitor de tela anuncia quando o loader aparece.
  const acessibilidade = decorativo
    ? { 'aria-hidden': true }
    : { role: 'status', 'aria-label': legenda || 'Carregando' }

  return (
    <span
      {...acessibilidade}
      className={className}
      style={{
        position: 'relative',
        display: 'inline-flex',
        flexDirection: 'column',
        alignItems: 'center',
        verticalAlign: 'middle',
        gap: Math.max(2, Math.round(tamanho * 0.16)),
      }}
    >
      {!decorativo && <span className="sr-only">{legenda || 'Carregando'}</span>}

      <svg
        width={tamanho}
        height={tamanho}
        viewBox="0 0 24 24"
        aria-hidden="true"
        style={{ display: 'block', overflow: 'visible' }}
      >
        {parado ? (
          <>
            <rect x="1" y="1" width="22" height="22" rx="4" style={{ fill: cor }} />
            <path
              d="M8 6v12h9"
              fill="none"
              strokeWidth="2.6"
              strokeLinecap="square"
              style={{ stroke: fundo }}
            />
          </>
        ) : (
          <g>
            {/* 5. tudo some no fim do ciclo */}
            <animate
              attributeName="opacity"
              values="1;1;0;0"
              keyTimes="0;0.84;0.96;1"
              dur={DURACAO}
              repeatCount="indefinite"
            />
            {/* 1. contorno (perímetro ≈ 76) */}
            <rect
              x="1.75"
              y="1.75"
              width="20.5"
              height="20.5"
              rx="3.6"
              fill="none"
              strokeWidth="1.5"
              strokeDasharray="76"
              strokeDashoffset="76"
              style={{ stroke: cor }}
            >
              <animate
                attributeName="stroke-dashoffset"
                values="76;0;0"
                keyTimes="0;0.34;1"
                calcMode="spline"
                keySplines="0.65 0 0.35 1;0 0 1 1"
                dur={DURACAO}
                repeatCount="indefinite"
              />
            </rect>
            {/* 2. preenchimento */}
            <rect x="1" y="1" width="22" height="22" rx="4" opacity="0" style={{ fill: cor }}>
              <animate
                attributeName="opacity"
                values="0;0;1;1"
                keyTimes="0;0.3;0.44;1"
                dur={DURACAO}
                repeatCount="indefinite"
              />
            </rect>
            {/* 3. recorte do L (comprimento ≈ 21) */}
            <path
              d="M8 6v12h9"
              fill="none"
              strokeWidth="2.6"
              strokeLinecap="square"
              strokeDasharray="22"
              strokeDashoffset="22"
              style={{ stroke: fundo }}
            >
              <animate
                attributeName="stroke-dashoffset"
                values="22;22;0;0"
                keyTimes="0;0.44;0.68;1"
                calcMode="spline"
                keySplines="0 0 1 1;0.65 0 0.35 1;0 0 1 1"
                dur={DURACAO}
                repeatCount="indefinite"
              />
            </path>
          </g>
        )}
      </svg>

      {mostrarLetreiro && (
        <svg
          width={larguraLetreiro}
          height={Math.round(larguraLetreiro * 0.2)}
          viewBox="0 0 100 20"
          aria-hidden="true"
          style={{ display: 'block', overflow: 'visible' }}
        >
          <text
            x="50"
            y="15"
            textAnchor="middle"
            fontFamily="'IBM Plex Mono', ui-monospace, monospace"
            fontWeight="700"
            fontSize="15"
            letterSpacing="2.4"
            style={{ fill: cor }}
          >
            {parado
              ? 'LOGOS'
              : LETRAS.map((letra, i) => (
                  // 4. varredura: cada letra acende 0,1 s depois da anterior
                  <tspan key={i} fillOpacity="0.3">
                    {letra}
                    <animate
                      attributeName="fill-opacity"
                      values="0.3;1;0.3;0.3"
                      keyTimes="0;0.1;0.3;1"
                      dur={DURACAO}
                      begin={`${0.9 + i * 0.1}s`}
                      repeatCount="indefinite"
                    />
                  </tspan>
                ))}
          </text>
        </svg>
      )}

      {legenda && (
        <span
          aria-hidden="true"
          className="font-medium whitespace-nowrap opacity-80"
          style={{ marginTop: 2, color: cor, fontSize: Math.max(12, Math.round(tamanho * 0.15)) }}
        >
          {legenda}
        </span>
      )}
    </span>
  )
}
