import { ROTULO_CRITICIDADE } from '@/api/rotulos'
import { CRITICIDADES, type Criticidade } from '@/api/tipos'
import { cn } from '@/lib/utils'
import { IconeCriticidade } from './Icones'
import type { ResumoCriticidade } from './resumo'
import { formatarTempoAberto } from './tempo'

// Cor, forma e peso tipográfico juntos (ADR 0004): quem não distingue o vermelho ainda lê
// o triângulo e o negrito.
const ESTILO: Record<Criticidade, { icone: string; numero: string; rotulo: string }> = {
  alta: {
    icone: 'bg-alta-fundo text-alta-texto border-alta-borda',
    numero: 'text-alta-numero font-bold',
    rotulo: 'font-bold',
  },
  media: {
    icone: 'bg-media-fundo text-media-texto border-media-borda',
    numero: 'text-media-numero font-semibold',
    rotulo: 'font-semibold',
  },
  baixa: {
    icone: 'bg-baixa-fundo text-baixa-texto border-baixa-borda',
    numero: 'text-baixa-numero font-medium',
    rotulo: 'font-normal',
  },
}

interface Props {
  /** null enquanto a primeira leitura não chegou. */
  porCriticidade: Record<Criticidade, ResumoCriticidade> | null
}

export function CartoesCriticidade({ porCriticidade }: Props) {
  return (
    <ul
      aria-label="Incidentes ativos por criticidade"
      className="grid grid-cols-[repeat(auto-fit,minmax(min(240px,100%),1fr))] gap-3"
    >
      {CRITICIDADES.map((criticidade) => {
        const resumo = porCriticidade?.[criticidade]
        const estilo = ESTILO[criticidade]
        const detalhe = !resumo
          ? 'Aguardando dados'
          : resumo.maisAntigoMin === null
            ? 'Nenhum ativo'
            : `Mais antigo ${formatarTempoAberto(resumo.maisAntigoMin)}`

        return (
          <li
            key={criticidade}
            className="flex min-h-[76px] items-center gap-3.5 rounded-lg border bg-card px-4 py-3"
          >
            <span
              className={cn(
                'flex size-9 flex-none items-center justify-center rounded-md border',
                estilo.icone,
              )}
            >
              <IconeCriticidade criticidade={criticidade} tamanho={18} />
            </span>
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className={cn('text-[15px] tracking-[0.04em] uppercase', estilo.rotulo)}>
                {ROTULO_CRITICIDADE[criticidade]}
              </span>
              <span className="text-[12.5px] whitespace-nowrap text-texto-3">{detalhe}</span>
            </span>
            <span
              className={cn(
                'ml-auto min-w-[2ch] text-right font-mono text-[30px] leading-none tabular-nums',
                estilo.numero,
              )}
            >
              {resumo ? resumo.quantidade : '–'}
            </span>
          </li>
        )
      })}
    </ul>
  )
}
