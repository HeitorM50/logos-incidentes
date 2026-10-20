import { Check } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { ROTULO_CRITICIDADE } from '@/api/rotulos'
import { CRITICIDADES, type Criticidade } from '@/api/tipos'
import { cn } from '@/lib/utils'
import { IconeCriticidade } from './Icones'
import { quantosAtivos, type ResumoCriticidade } from './resumo'
import { formatarTempoAberto } from './tempo'

// Cor, forma e peso tipográfico juntos (ADR 0004): quem não distingue o vermelho ainda lê
// o triângulo e o negrito.
const ESTILO: Record<
  Criticidade,
  { icone: string; numero: string; rotulo: string; barra: string }
> = {
  alta: {
    icone: 'bg-alta-fundo text-alta-texto border-alta-borda',
    numero: 'text-alta-numero font-bold',
    rotulo: 'font-bold',
    barra: 'bg-alta-borda',
  },
  media: {
    icone: 'bg-media-fundo text-media-texto border-media-borda',
    numero: 'text-media-numero font-semibold',
    rotulo: 'font-semibold',
    barra: 'bg-media-borda',
  },
  baixa: {
    icone: 'bg-baixa-fundo text-baixa-texto border-baixa-borda',
    numero: 'text-baixa-numero font-medium',
    rotulo: 'font-normal',
    barra: 'bg-baixa-borda',
  },
}

interface Props {
  /** null enquanto a primeira leitura não chegou. */
  porCriticidade: Record<Criticidade, ResumoCriticidade> | null
  selecionadas: Criticidade[]
  aoAlternar: (criticidade: Criticidade) => void
}

// Cada cartão é também o filtro da sua criticidade (gestão por exceção: um clique em ALTA
// deixa só o que pede ação imediata).
// Acima disso, um Alta esperando já é atraso: o "mais antigo" muda de tom.
const LIMITE_ALTA_MIN = 30

/** Para onde o número foi na última mudança (null na primeira leitura e sem mudança). */
function useDirecao(valor: number | null): { direcao: 'sobe' | 'desce' | null; chave: number } {
  const [estado, setEstado] = useState<{
    valor: number | null
    direcao: 'sobe' | 'desce' | null
    chave: number
  }>({ valor, direcao: null, chave: 0 })
  if (valor !== estado.valor) {
    const anterior = estado.valor
    const direcao =
      anterior === null || valor === null ? null : valor > anterior ? 'sobe' : 'desce'
    setEstado({ valor, direcao, chave: estado.chave + 1 })
  }
  return { direcao: estado.direcao, chave: estado.chave }
}

/** O número novo entra pela direção da mudança: de baixo quando sobe, de cima quando desce. */
function NumeroDeslizante({ valor }: { valor: number }) {
  const { direcao, chave } = useDirecao(valor)
  return (
    <span
      key={chave}
      className={cn(
        'inline-block',
        direcao && 'animate-in duration-300 fade-in-0',
        direcao === 'sobe' && 'slide-in-from-bottom-3',
        direcao === 'desce' && 'slide-in-from-top-3',
      )}
    >
      {valor}
    </span>
  )
}

/** Alta aumentou: um anel em volta do ícone, uma vez (a chave nova reinicia a animação). */
function PulsoAoSubir({
  valor,
  ativo,
  children,
}: {
  valor: number | null
  ativo: boolean
  children: ReactNode
}) {
  const { direcao, chave } = useDirecao(valor)
  return (
    <span
      key={chave}
      className={cn(
        'flex flex-none rounded-md',
        ativo && direcao === 'sobe' && 'animate-pulso-anel',
      )}
    >
      {children}
    </span>
  )
}

export function CartoesCriticidade({ porCriticidade, selecionadas, aoAlternar }: Props) {
  // Parte de cada criticidade nos ativos (barra do cartão). O número continua sendo o que o
  // analista lê; a barra só dá a proporção de relance.
  const totalAtivos = porCriticidade
    ? CRITICIDADES.reduce((soma, c) => soma + porCriticidade[c].quantidade, 0)
    : 0
  return (
    <ul
      aria-label="Filtrar por criticidade"
      className="grid grid-cols-[repeat(auto-fit,minmax(min(260px,100%),1fr))] gap-3"
    >
      {CRITICIDADES.map((criticidade) => {
        const resumo = porCriticidade?.[criticidade]
        const estilo = ESTILO[criticidade]
        const detalhe = !resumo
          ? 'Aguardando dados'
          : resumo.maisAntigoMin === null
            ? 'Nenhum ativo'
            : `Mais antigo ${formatarTempoAberto(resumo.maisAntigoMin)}`

        const marcado = selecionadas.includes(criticidade)
        const parte =
          resumo && totalAtivos ? Math.round((resumo.quantidade / totalAtivos) * 100) : 0

        return (
          <li key={criticidade} className="flex">
            <button
              type="button"
              aria-pressed={marcado}
              aria-label={
                resumo?.quantidade
                  ? `${ROTULO_CRITICIDADE[criticidade]}: ${quantosAtivos(resumo.quantidade)}. ${detalhe}`
                  : `${ROTULO_CRITICIDADE[criticidade]}: ${detalhe}`
              }
              onClick={() => aoAlternar(criticidade)}
              className={cn(
                'elevar flex flex-1 cursor-pointer flex-col gap-3.5 rounded-[22px] bg-card px-[18px] pt-4 pb-3.5 text-left shadow-cartao outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
                marcado && 'shadow-[inset_0_0_0_2px_var(--foreground),var(--sombra-cartao)]',
              )}
            >
              <span className="flex w-full items-center gap-3">
              <PulsoAoSubir valor={resumo?.quantidade ?? null} ativo={criticidade === 'alta'}>
                <span
                  className={cn(
                    'flex size-[42px] flex-none items-center justify-center rounded-[14px] border',
                    estilo.icone,
                  )}
                >
                  <IconeCriticidade criticidade={criticidade} tamanho={18} />
                </span>
              </PulsoAoSubir>
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="flex items-center gap-1.5">
                  <span className={cn('text-[15px] tracking-[0.04em] uppercase', estilo.rotulo)}>
                    {ROTULO_CRITICIDADE[criticidade]}
                  </span>
                  {marcado && (
                    <span
                      aria-hidden
                      className="flex items-center gap-1 text-xs font-semibold text-texto-2"
                    >
                      <Check
                        className="size-3 animate-in duration-200 zoom-in-50 fade-in-0"
                        strokeWidth={3}
                      />
                      Filtrando
                    </span>
                  )}
                </span>
                {/* Alta aberto há mais de 30 min: o texto ganha o tom de alerta aos poucos. */}
                <span
                  className={cn(
                    'text-[12.5px] whitespace-nowrap transition-colors duration-[2000ms]',
                    criticidade === 'alta' &&
                      resumo?.maisAntigoMin != null &&
                      resumo.maisAntigoMin > LIMITE_ALTA_MIN
                      ? 'font-medium text-alta-numero'
                      : 'text-texto-3',
                  )}
                >
                  {detalhe}
                </span>
              </span>
              <span
                className={cn(
                  'ml-auto min-w-[2ch] text-right font-mono text-[32px] leading-none tracking-[-0.02em] tabular-nums',
                  estilo.numero,
                )}
              >
                {resumo ? <NumeroDeslizante valor={resumo.quantidade} /> : '–'}
              </span>
              </span>
              <span aria-hidden className="flex w-full items-center gap-2.5">
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-trilho">
                  <span
                    className={cn(
                      'block h-full rounded-full transition-[width] duration-700 ease-[cubic-bezier(0.2,0.8,0.2,1)]',
                      estilo.barra,
                    )}
                    style={{ width: `${parte}%` }}
                  />
                </span>
                <span className="font-mono text-[11.5px] text-texto-2 tabular-nums">
                  {parte}% ativos
                </span>
              </span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}
