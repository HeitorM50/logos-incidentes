import type { MapaDaFrota, VeiculoNoMapa } from '@/api/frota'
import { cn } from '@/lib/utils'
import { CIDADES, CONTORNO_BRASIL } from './brasil'
import { situacaoDoVeiculo } from './situacao'

// Mapa esquemático: projeção equirretangular simples, enquadrada nas rodovias da frota
// (Sul, Sudeste e Centro-Oeste). As unidades do SVG são graus; os traços usam
// vector-effect para manter a espessura em pixels em qualquer tamanho.
const LON_MIN = -58.6
const LON_MAX = -40.6
const LAT_MAX = -10.4
const LAT_MIN = -30.2
// Corrige o achatamento da longitude perto de 20° S.
const K = Math.cos((20 * Math.PI) / 180)
const LARGURA = (LON_MAX - LON_MIN) * K
const ALTURA = LAT_MAX - LAT_MIN

const x = (lon: number) => (lon - LON_MIN) * K
const y = (lat: number) => LAT_MAX - lat
const caminho = (pontos: [number, number][]) =>
  pontos.map(([lat, lon], n) => `${n ? 'L' : 'M'}${x(lon).toFixed(3)} ${y(lat).toFixed(3)}`).join(' ')

const COR_CRITICIDADE = {
  alta: 'fill-alta-borda',
  media: 'fill-media-borda',
  baixa: 'fill-baixa-borda',
} as const

interface Props {
  mapa: MapaDaFrota
  /** Clique num caminhão com incidente: leva a lista da triagem até ele. */
  aoVerIncidente: (id: number) => void
}

function Caminhao({ veiculo, aoVerIncidente }: { veiculo: VeiculoNoMapa; aoVerIncidente: Props['aoVerIncidente'] }) {
  const cx = x(veiculo.longitude!)
  const cy = y(veiculo.latitude!)
  const situacao = situacaoDoVeiculo(veiculo)
  const titulo = `${veiculo.placa} — ${veiculo.referencia ?? ''}`
  if (situacao === 'incidente') {
    const incidente = veiculo.incidente!
    return (
      <g
        className="cursor-pointer"
        onClick={() => aoVerIncidente(incidente.id)}
      >
        <title>{`${titulo}: #${incidente.id} ${incidente.titulo}`}</title>
        <circle
          cx={cx}
          cy={cy}
          r={0.42}
          className={cn('opacity-25 motion-safe:animate-pulse', COR_CRITICIDADE[incidente.criticidade])}
        />
        <circle
          cx={cx}
          cy={cy}
          r={0.2}
          className={cn('stroke-card', COR_CRITICIDADE[incidente.criticidade])}
          strokeWidth={1.5}
          vectorEffect="non-scaling-stroke"
        />
      </g>
    )
  }
  if (situacao === 'parado') {
    return (
      <rect x={cx - 0.13} y={cy - 0.13} width={0.26} height={0.26} className="fill-media-borda">
        <title>{`${titulo}: parado`}</title>
      </rect>
    )
  }
  return (
    <circle
      cx={cx}
      cy={cy}
      r={0.13}
      className={situacao === 'patio' ? 'fill-card stroke-texto-3' : 'fill-foreground'}
      strokeWidth={situacao === 'patio' ? 1.2 : 0}
      vectorEffect="non-scaling-stroke"
    >
      <title>{`${titulo}: ${situacao === 'patio' ? 'no pátio' : `${veiculo.velocidade_kmh} km/h`}`}</title>
    </circle>
  )
}

export function MapaFrota({ mapa, aoVerIncidente }: Props) {
  const comPosicao = mapa.veiculos.filter((v) => v.latitude !== null && v.longitude !== null)
  // Os com incidente por cima dos outros.
  const emOrdem = [
    ...comPosicao.filter((v) => !v.incidente),
    ...comPosicao.filter((v) => v.incidente),
  ]
  return (
    // Decorativo para o leitor de tela: a lista ao lado traz as mesmas informações.
    <svg
      aria-hidden
      viewBox={`0 0 ${LARGURA.toFixed(2)} ${ALTURA.toFixed(2)}`}
      // Mar e países vizinhos num tom azulado suave; o Brasil em cinza claro, com borda.
      className="h-full w-full rounded-2xl bg-[color-mix(in_oklab,var(--info-fundo)_70%,var(--card))]"
    >
      <path
        d={`${CONTORNO_BRASIL.map(([lon, lat], n) => `${n ? 'L' : 'M'}${x(lon)} ${y(lat)}`).join(' ')} Z`}
        className="fill-superficie-2 stroke-borda-forte"
        strokeWidth={1}
        vectorEffect="non-scaling-stroke"
      />
      {mapa.rotas.map((rota) => (
        <path
          key={rota.rodovia}
          d={caminho(rota.pontos)}
          fill="none"
          className="stroke-texto-3"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      ))}
      {CIDADES.map((cidade) => (
        <text
          key={cidade.nome}
          x={x(cidade.lon) + (cidade.fim ? -0.3 : 0.25)}
          y={y(cidade.lat) - 0.2}
          textAnchor={cidade.fim ? 'end' : 'start'}
          fontSize={0.42}
          className="fill-texto-3 font-sans"
        >
          {cidade.nome}
        </text>
      ))}
      {emOrdem.map((veiculo) => (
        <Caminhao key={veiculo.placa} veiculo={veiculo} aoVerIncidente={aoVerIncidente} />
      ))}
    </svg>
  )
}
