import { useSyncExternalStore } from 'react'

// Rotas da frota no painel do login (protótipo de 20/10): três estradas, os caminhões andando
// por elas e um alerta pulsando onde um incidente acabou de chegar. SVG puro; as animações são
// SMIL (<animate>, <animateMotion>), que o CSS de prefers-reduced-motion não alcança: com menos
// movimento, o desenho fica parado.

const ROTAS = [
  'M-40 470 C 120 400, 160 250, 320 260 S 520 160, 660 60',
  'M-40 560 C 140 520, 260 470, 360 380 S 520 300, 660 330',
  'M80 -40 C 120 120, 60 220, 180 330 S 300 520, 260 660',
]
// Duração, atraso e opacidade de cada caminhão (um por rota).
const CAMINHOES = [
  { duracao: '11s', inicio: '0s', opacidade: 1, parado: { x: 108, y: 418 } },
  { duracao: '14s', inicio: '-5s', opacidade: 0.7, parado: { x: 440, y: 335 } },
  { duracao: '13s', inicio: '-3s', opacidade: 0.55, parado: { x: 130, y: 285 } },
]
const ALERTA = { x: 320, y: 260 }

const CONSULTA = '(prefers-reduced-motion: reduce)'
function assinar(aoMudar: () => void) {
  const consulta = window.matchMedia?.(CONSULTA)
  consulta?.addEventListener('change', aoMudar)
  return () => consulta?.removeEventListener('change', aoMudar)
}
const semMovimento = () => window.matchMedia?.(CONSULTA).matches ?? false

export function PainelRotas() {
  const parado = useSyncExternalStore(assinar, semMovimento, () => true)
  return (
    <svg
      aria-hidden
      viewBox="0 0 600 600"
      preserveAspectRatio="xMidYMid slice"
      className="pointer-events-none absolute inset-0 size-full"
    >
      {ROTAS.map((rota) => (
        <path key={rota} d={rota} fill="none" stroke="rgb(255 255 255 / 0.08)" strokeWidth={2} />
      ))}
      {/* Tracejado andando nas duas rotas principais: o fluxo da frota. */}
      {ROTAS.slice(0, 2).map((rota, i) => (
        <path
          key={`fluxo-${rota}`}
          d={rota}
          fill="none"
          stroke="rgb(255 255 255 / 0.32)"
          strokeWidth={2}
          strokeDasharray="2 14"
          strokeLinecap="round"
        >
          {!parado && (
            <animate
              attributeName="stroke-dashoffset"
              from="0"
              to="-160"
              dur={i === 0 ? '6s' : '8s'}
              repeatCount="indefinite"
            />
          )}
        </path>
      ))}
      {CAMINHOES.map((caminhao, i) =>
        parado ? (
          <circle
            key={ROTAS[i]}
            cx={caminhao.parado.x}
            cy={caminhao.parado.y}
            r={5}
            fill="#ffffff"
            opacity={caminhao.opacidade}
          />
        ) : (
          <circle key={ROTAS[i]} r={5} fill="#ffffff" opacity={caminhao.opacidade}>
            <animateMotion
              dur={caminhao.duracao}
              begin={caminhao.inicio}
              repeatCount="indefinite"
              path={ROTAS[i]}
            />
          </circle>
        ),
      )}
      {!parado && (
        <circle cx={ALERTA.x} cy={ALERTA.y} r={7} fill="none" stroke="#ff7b6b" strokeWidth={2}>
          <animate attributeName="r" values="7;34" dur="2.2s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.9;0" dur="2.2s" repeatCount="indefinite" />
        </circle>
      )}
      <circle cx={ALERTA.x} cy={ALERTA.y} r={7} fill="#ff7b6b" />
    </svg>
  )
}
