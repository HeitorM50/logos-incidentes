import { MotionConfig, motion, useReducedMotion } from 'framer-motion'
import { AlarmClock, ArrowDown, ArrowUp, Equal, Flag, Timer } from 'lucide-react'
import type { ReactNode } from 'react'
import CountUpImportado from 'react-countup'
import {
  AreaSeries,
  AreaSparklineChart,
  FunnelArc,
  FunnelAxis,
  FunnelAxisLabel,
  FunnelAxisLine,
  FunnelChart,
  FunnelSeries,
} from 'reaviz'
import type { Metrica, Relatorio } from '@/api/relatorio'
import { cn } from '@/lib/utils'
import { formatarDuracao } from '@/features/incidents/tempo'
import { useCoresTema } from './useCoresTema'
import { variacao } from './variacao'

// react-countup só tem build CommonJS: no build do Vite, o default chega embrulhado
// ({ default: CountUp }); nos testes, chega direto. Desembrulha nos dois casos.
const CountUp =
  (CountUpImportado as unknown as { default?: typeof CountUpImportado }).default ??
  CountUpImportado

// "Incident Report" adaptado para a frota: o funil do atendimento, os recebidos e os tempos,
// sempre comparados com o período anterior. Este arquivo é carregado só quando o painel abre
// (React.lazy): reaviz, framer-motion e react-countup não pesam na abertura da triagem.

interface Props {
  relatorio: Relatorio
}

/** Seta, sinal e número: a variação é legível sem depender da cor. */
function Chip({ metrica, maisEhPior = true }: { metrica: Metrica; maisEhPior?: boolean }) {
  const v = variacao(metrica)
  if (!v) {
    return <span className="text-xs text-texto-3">sem comparação</span>
  }
  const ruim = v.direcao !== 'igual' && (v.direcao === 'sobe') === maisEhPior
  const Icone = v.direcao === 'sobe' ? ArrowUp : v.direcao === 'desce' ? ArrowDown : Equal
  const sinal = v.direcao === 'sobe' ? '+' : v.direcao === 'desce' ? '−' : ''
  return (
    <span
      className={cn(
        'inline-flex h-6 items-center gap-0.5 rounded-full px-2 font-mono text-xs font-semibold tabular-nums',
        v.direcao === 'igual'
          ? 'bg-pilula text-texto-2'
          : ruim
            ? 'bg-erro-fundo text-erro-texto'
            : 'bg-[color-mix(in_oklab,var(--ao-vivo)_9%,transparent)] text-ao-vivo',
      )}
    >
      <Icone aria-hidden className="size-3.5" strokeWidth={2.5} />
      {sinal}
      {v.pct}%
      <span className="sr-only">
        {' '}
        em relação ao período anterior{ruim ? ' (piorou)' : v.direcao === 'igual' ? '' : ' (melhorou)'}
      </span>
    </span>
  )
}

function Numero({ titulo, metrica }: { titulo: string; metrica: Metrica }) {
  const reduzir = useReducedMotion()
  const atual = metrica.atual ?? 0
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
      <span className="text-[15px]">{titulo}</span>
      <div className="flex flex-wrap items-center gap-2">
        <CountUp
          className="font-mono text-[34px] leading-none font-semibold tabular-nums"
          start={0}
          end={atual}
          duration={reduzir ? 0 : 1.6}
          preserveValue
        />
        <Chip metrica={metrica} />
      </div>
      <span className="text-[13px] text-texto-3">
        {metrica.anterior === null
          ? 'Sem período anterior para comparar'
          : `Comparado a ${metrica.anterior} no período anterior`}
      </span>
    </div>
  )
}

function minutos(valor: number | null): string {
  return valor === null ? '—' : formatarDuracao(Math.round(valor))
}

function LinhaMetrica({
  icone,
  rotulo,
  valor,
  metrica,
  indice,
}: {
  icone: ReactNode
  rotulo: string
  valor: string
  metrica: Metrica
  indice: number
}) {
  return (
    <motion.li
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15 + indice * 0.06, duration: 0.35, ease: [0.2, 0.8, 0.2, 1] }}
      className="flex items-center gap-3 py-3.5"
    >
      <span className="flex min-w-0 flex-1 items-center gap-2 text-[14px] text-texto-2">
        {icone}
        <span className="truncate">{rotulo}</span>
      </span>
      <span className="font-mono text-[17px] font-semibold tabular-nums">{valor}</span>
      <Chip metrica={metrica} />
    </motion.li>
  )
}

export default function ConteudoRelatorio({ relatorio }: Props) {
  const cores = useCoresTema()
  const funil = relatorio.funil.map((etapa) => ({ key: etapa.etapa, data: etapa.quantidade }))
  const temDados = relatorio.funil[0].quantidade > 0
  const serie = relatorio.serie.map((ponto) => ({ key: new Date(ponto.inicio), data: ponto.total }))
  const pontoSerie = relatorio.horas > 24 ? 'a cada 7 h' : 'por hora'

  return (
    // reducedMotion="user": com prefers-reduced-motion, o framer-motion não anima.
    <MotionConfig reducedMotion="user">
      <div className="flex flex-col gap-6">
        <figure className="flex flex-col gap-2">
          <figcaption className="text-xs font-semibold tracking-[0.04em] text-texto-2 uppercase">
            Funil do atendimento
          </figcaption>
          {temDados ? (
            <div aria-hidden className="h-[220px] w-full">
              <FunnelChart
                id="funil-atendimento"
                height={220}
                data={funil}
                series={
                  <FunnelSeries
                    arc={
                      <FunnelArc
                        colorScheme={[cores['--info-borda']]}
                        gradient={null}
                        glow={{ blur: 24, color: cores['--info-borda'] }}
                      />
                    }
                    axis={
                      <FunnelAxis
                        label={
                          <FunnelAxisLabel
                            fill={cores['--texto-2']}
                            fontSize={12}
                            fontFamily="Geist Variable, system-ui, sans-serif"
                            labelVisibility="always"
                          />
                        }
                        line={<FunnelAxisLine strokeColor={cores['--border']} />}
                      />
                    }
                  />
                }
              />
            </div>
          ) : (
            <p className="rounded-2xl bg-superficie-2 px-4 py-6 text-center text-sm text-texto-2">
              Nenhum incidente recebido neste período.
            </p>
          )}
          {/* O funil em texto, para leitor de tela (o gráfico é decorativo). */}
          <ol className="sr-only">
            {relatorio.funil.map((etapa) => (
              <li key={etapa.etapa}>
                {etapa.etapa}: {etapa.quantidade}
              </li>
            ))}
          </ol>
        </figure>

        <div className="flex flex-wrap gap-x-6 gap-y-5">
          <Numero titulo="Alta recebidos" metrica={relatorio.alta} />
          <Numero titulo="Total recebidos" metrica={relatorio.recebidos} />
        </div>

        <ul className="flex flex-col divide-y">
          <LinhaMetrica
            indice={0}
            icone={<Timer aria-hidden className="size-4 flex-none" />}
            rotulo="Tempo médio até assumir"
            valor={minutos(relatorio.tempo_ate_assumir_min.atual)}
            metrica={relatorio.tempo_ate_assumir_min}
          />
          <LinhaMetrica
            indice={1}
            icone={<Flag aria-hidden className="size-4 flex-none" />}
            rotulo="Tempo médio até fechar"
            valor={minutos(relatorio.tempo_ate_fechar_min.atual)}
            metrica={relatorio.tempo_ate_fechar_min}
          />
          <LinhaMetrica
            indice={2}
            icone={<AlarmClock aria-hidden className="size-4 flex-none" />}
            rotulo="Taxa de atraso (sem responsável além do prazo)"
            valor={
              relatorio.taxa_atraso_pct.atual === null
                ? '—'
                : `${relatorio.taxa_atraso_pct.atual}%`
            }
            metrica={relatorio.taxa_atraso_pct}
          />
        </ul>

        <figure className="flex flex-col gap-2">
          <figcaption className="flex items-baseline justify-between text-xs font-semibold tracking-[0.04em] text-texto-2 uppercase">
            Recebidos {pontoSerie}
            <span className="font-mono font-normal tracking-normal normal-case">
              máx. {Math.max(0, ...relatorio.serie.map((p) => p.total))}
            </span>
          </figcaption>
          <div aria-hidden className="h-16 w-full">
            <AreaSparklineChart
              height={64}
              data={serie}
              series={
                <AreaSeries colorScheme={[cores['--foreground']]} interpolation="smooth" />
              }
            />
          </div>
          <p className="sr-only">
            Recebidos {pontoSerie}: {relatorio.serie.map((p) => p.total).join(', ')}.
          </p>
        </figure>
      </div>
    </MotionConfig>
  )
}
