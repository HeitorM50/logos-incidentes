import { cn } from '@/lib/utils'
import { SITUACOES, type Situacao } from './filtros'
import { quantosNaSituacao } from './resumo'

const ROTULO: Record<Situacao, string> = {
  ativos: 'Ativos',
  fechados: 'Fechados',
  todos: 'Todos',
}

interface Props {
  situacao: Situacao
  /** Quantos incidentes cada opção mostraria (null antes da primeira leitura). */
  contagem: Record<Situacao, number> | null
  aoEscolher: (situacao: Situacao) => void
}

/**
 * Ativos (padrão), Fechados ou Todos. Os fechados não pedem ação: ficam fora da triagem, mas
 * a consulta do que já foi resolvido está a um clique.
 */
export function SeletorSituacao({ situacao, contagem, aoEscolher }: Props) {
  return (
    <div
      role="group"
      aria-label="Situação"
      className="inline-flex h-[38px] items-center rounded-full bg-card p-1 shadow-cartao"
    >
      {SITUACOES.map((opcao) => {
        const marcada = opcao === situacao
        return (
          <button
            key={opcao}
            type="button"
            aria-pressed={marcada}
            aria-label={
              contagem ? `${ROTULO[opcao]} ${quantosNaSituacao(contagem[opcao], opcao)}` : undefined
            }
            onClick={() => aoEscolher(opcao)}
            className={cn(
              'flex h-full cursor-pointer items-center gap-1.5 rounded-full px-3 text-[13px] font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
              marcada ? 'bg-primary text-primary-foreground' : 'text-texto-2 hover:bg-superficie-2',
            )}
          >
            {ROTULO[opcao]}{' '}
            <span className={cn('font-mono text-xs tabular-nums', marcada && 'opacity-85')}>
              {contagem ? contagem[opcao] : '–'}
            </span>
          </button>
        )
      })}
    </div>
  )
}
