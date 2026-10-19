import { ChevronRight } from 'lucide-react'
import { ROTULO_CATEGORIA, ROTULO_CRITICIDADE, ROTULO_STATUS } from '@/api/rotulos'
import type { Criticidade, Incidente } from '@/api/tipos'
import { cn } from '@/lib/utils'
import { IconeCriticidade, IconeStatus } from './Icones'
import { formatarTempoAberto, minutosDesde } from './tempo'

export const COLUNAS_TABELA =
  'grid-cols-[96px_minmax(220px,2fr)_176px_minmax(190px,1.4fr)_128px_150px_minmax(140px,1fr)]'

const SELO: Record<Criticidade, string> = {
  alta: 'bg-alta-fundo text-alta-texto border-alta-borda font-bold',
  media: 'bg-media-fundo text-media-texto border-media-borda font-semibold',
  baixa: 'bg-baixa-fundo text-baixa-texto border-baixa-borda font-normal',
}

const FORMATO_DATA = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
})

interface Props {
  incidente: Incidente
  idAnalista: number
  agora: number
  aberta: boolean
  aoAlternar: () => void
}

export function LinhaIncidente({ incidente, idAnalista, agora, aberta, aoAlternar }: Props) {
  const fechado = incidente.status === 'fechado'
  const meu = incidente.responsavel?.id === idAnalista
  const idDetalhes = `detalhes-incidente-${incidente.id}`

  return (
    <li
      className={cn(
        'grid min-h-11 items-center gap-x-3 border-b bg-card px-3 py-1.5 last:border-b-0',
        COLUNAS_TABELA,
        fechado && 'text-texto-3',
      )}
    >
      <span
        className={cn(
          'inline-flex h-6 items-center gap-1.5 justify-self-start rounded-sm border px-2 text-xs tracking-[0.05em] whitespace-nowrap uppercase',
          SELO[incidente.criticidade],
          fechado && 'opacity-60',
        )}
      >
        <IconeCriticidade criticidade={incidente.criticidade} />
        {ROTULO_CRITICIDADE[incidente.criticidade]}
      </span>

      <span className="flex min-w-0 items-center gap-1.5">
        <button
          type="button"
          onClick={aoAlternar}
          aria-expanded={aberta}
          aria-controls={aberta ? idDetalhes : undefined}
          aria-label={`${aberta ? 'Ocultar' : 'Ver'} detalhes de #${incidente.id}`}
          className={cn(
            'flex size-7 flex-none items-center justify-center rounded-[5px] border text-texto-2',
            aberta ? 'border-borda-forte bg-superficie-2' : 'border-transparent hover:bg-accent',
          )}
        >
          <ChevronRight
            aria-hidden
            className={cn('size-4 transition-transform duration-150', aberta && 'rotate-90')}
          />
        </button>
        <span className="flex-none font-mono text-xs text-texto-3">#{incidente.id}</span>
        <span
          title={incidente.titulo}
          className={cn(
            'min-w-0 truncate text-sm',
            incidente.criticidade === 'alta' ? 'font-semibold' : 'font-medium',
          )}
        >
          {incidente.titulo}
        </span>
      </span>

      <span className="text-[13px] leading-tight text-texto-2">
        {ROTULO_CATEGORIA[incidente.categoria]}
      </span>

      <span title={incidente.local} className="truncate text-[13px]">
        {incidente.local}
      </span>

      <span className="font-mono text-[13px] whitespace-nowrap">
        {formatarTempoAberto(minutosDesde(incidente.criado_em, agora))}
      </span>

      <span className="flex items-center gap-1.5 text-[13px] whitespace-nowrap text-texto-2">
        <IconeStatus status={incidente.status} />
        {ROTULO_STATUS[incidente.status]}
      </span>

      <span
        className={cn(
          'truncate text-[13px]',
          !incidente.responsavel && 'text-texto-3 italic',
          meu && 'font-semibold',
        )}
      >
        {incidente.responsavel ? (meu ? 'Você' : incidente.responsavel.nome) : 'Sem responsável'}
      </span>

      {aberta && (
        <section
          id={idDetalhes}
          aria-label={`Detalhes de #${incidente.id}`}
          className="col-span-full mt-1.5 mb-2 grid gap-x-8 gap-y-3 rounded-md border bg-superficie-2 px-4 py-3 text-[13px] sm:grid-cols-[2fr_1fr_1fr]"
        >
          <div className="flex flex-col gap-1">
            <p className="text-xs font-semibold tracking-[0.04em] text-texto-2 uppercase">
              Descrição
            </p>
            <p className="leading-normal whitespace-pre-line">
              {incidente.descricao || (
                <span className="text-texto-3 italic">Sem descrição.</span>
              )}
            </p>
          </div>
          <dl className="grid grid-cols-[auto_1fr] content-start gap-x-3 gap-y-1">
            <dt className="text-texto-3">Placa</dt>
            <dd className="font-mono">{incidente.placa ?? '—'}</dd>
            <dt className="text-texto-3">Local</dt>
            <dd>{incidente.local}</dd>
          </dl>
          <dl className="grid grid-cols-[auto_1fr] content-start gap-x-3 gap-y-1">
            <dt className="text-texto-3">Aberto em</dt>
            <dd className="font-mono">{FORMATO_DATA.format(new Date(incidente.criado_em))}</dd>
            <dt className="text-texto-3">Alterado em</dt>
            <dd className="font-mono">
              {FORMATO_DATA.format(new Date(incidente.atualizado_em))}
            </dd>
            <dt className="text-texto-3">Por</dt>
            <dd>{incidente.atualizado_por?.nome ?? '—'}</dd>
          </dl>
        </section>
      )}
    </li>
  )
}
