import { Check } from 'lucide-react'
import { ROTULO_CRITICIDADE } from '@/api/rotulos'
import { CRITICIDADES, type Criticidade } from '@/api/tipos'
import { cn } from '@/lib/utils'
import { IconeCriticidade } from './Icones'
import { quantosAtivos, type ResumoCriticidade } from './resumo'
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
  selecionadas: Criticidade[]
  aoAlternar: (criticidade: Criticidade) => void
}

// Cada cartão é também o filtro da sua criticidade (gestão por exceção: um clique em ALTA
// deixa só o que pede ação imediata).
export function CartoesCriticidade({ porCriticidade, selecionadas, aoAlternar }: Props) {
  return (
    <ul
      aria-label="Filtrar por criticidade"
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

        const marcado = selecionadas.includes(criticidade)

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
                'flex min-h-[76px] flex-1 cursor-pointer items-center gap-3.5 rounded-lg border px-4 py-3 text-left transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
                marcado
                  ? 'border-foreground bg-superficie-2 shadow-[inset_0_0_0_1px_var(--foreground)]'
                  : 'bg-card hover:border-borda-forte',
              )}
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
                <span className="flex items-center gap-1.5">
                  <span className={cn('text-[15px] tracking-[0.04em] uppercase', estilo.rotulo)}>
                    {ROTULO_CRITICIDADE[criticidade]}
                  </span>
                  {marcado && (
                    <span
                      aria-hidden
                      className="flex items-center gap-1 text-xs font-semibold text-texto-2"
                    >
                      <Check className="size-3" strokeWidth={3} />
                      Filtrando
                    </span>
                  )}
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
            </button>
          </li>
        )
      })}
    </ul>
  )
}
