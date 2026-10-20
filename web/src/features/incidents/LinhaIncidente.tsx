import { ChevronRight, Pencil, Trash2 } from 'lucide-react'
import { ROTULO_CATEGORIA, ROTULO_CRITICIDADE, ROTULO_STATUS } from '@/api/rotulos'
import type { Criticidade, Incidente } from '@/api/tipos'
import { cn } from '@/lib/utils'
import type { Acao } from './acoes'
import { AcoesLinha, EM_ANDAMENTO, SEM_CONEXAO } from './AcoesLinha'
import { AvisoConflito } from './Avisos'
import { BotaoComMotivo } from './BotaoComMotivo'
import { motivoEdicao } from './formulario'
import { IconeCriticidade, IconeStatus } from './Icones'
import { formatarTempoAberto, minutosDesde } from './tempo'
import type { Conflito } from './useAcoesIncidente'

// Mínimos somam 1.280 px com espaços: a tabela cabe sem rolagem lateral num notebook de 1366
// px (com a margem da página e a barra de rolagem). Em telas maiores, título e local crescem.
export const COLUNAS_TABELA =
  'grid-cols-[88px_minmax(160px,2fr)_160px_minmax(170px,1.4fr)_104px_136px_120px_232px]'

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
  pendente?: Acao
  conflito?: Conflito
  semConexao: boolean
  aoExecutar: (acao: Acao) => void
  aoDispensarConflito: () => void
  aoEditar: () => void
  aoRemover: () => void
  /** Alta que acabou de chegar: destaque por alguns segundos (useAltaNova). */
  novo?: boolean
}

export function LinhaIncidente({
  incidente,
  idAnalista,
  agora,
  aberta,
  aoAlternar,
  pendente,
  conflito,
  semConexao,
  aoExecutar,
  aoDispensarConflito,
  aoEditar,
  aoRemover,
  novo = false,
}: Props) {
  const fechado = incidente.status === 'fechado'
  const meu = incidente.responsavel?.id === idAnalista
  const idDetalhes = `detalhes-incidente-${incidente.id}`
  const motivoAlterar = pendente
    ? EM_ANDAMENTO
    : semConexao
      ? SEM_CONEXAO
      : motivoEdicao(incidente, idAnalista)

  return (
    <div
      role="none"
      data-incidente={incidente.id}
      className={cn(
        'border-b px-3 py-1.5 last:border-b-0',
        conflito
          ? 'bg-info-fundo'
          : pendente
            ? 'bg-linha-pendente'
            : novo
              ? 'bg-alta-fundo/10'
              : 'bg-card',
        fechado && 'text-texto-3',
      )}
    >
      <div role="row" className={cn('grid min-h-8 items-center gap-x-3', COLUNAS_TABELA)}>
        <span
          role="cell"
          className={cn(
            'inline-flex h-6 items-center gap-1.5 justify-self-start rounded-sm border px-2 text-xs tracking-[0.05em] whitespace-nowrap uppercase',
            SELO[incidente.criticidade],
            fechado && 'opacity-60',
          )}
        >
          <IconeCriticidade criticidade={incidente.criticidade} />
          {ROTULO_CRITICIDADE[incidente.criticidade]}
        </span>

        <span role="cell" className="flex min-w-0 items-center gap-1.5">
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
          {/* Texto, e não só a cor do fundo: o destaque precisa ser legível sem cor. */}
          {novo && (
            <span className="flex-none rounded-sm bg-alta-fundo px-1.5 py-px text-[10px] font-bold tracking-[0.06em] text-alta-texto uppercase">
              Novo
            </span>
          )}
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

        <span role="cell" className="text-[13px] leading-tight text-texto-2">
          {ROTULO_CATEGORIA[incidente.categoria]}
        </span>

        <span role="cell" title={incidente.local} className="truncate text-[13px]">
          {incidente.local}
        </span>

        <span role="cell" className="font-mono text-[13px] whitespace-nowrap">
          {formatarTempoAberto(minutosDesde(incidente.criado_em, agora))}
        </span>

        <span role="cell" className="flex items-center gap-1.5 text-[13px] whitespace-nowrap text-texto-2">
          <IconeStatus status={incidente.status} />
          {ROTULO_STATUS[incidente.status]}
        </span>

        <span
          role="cell"
          className={cn(
            'truncate text-[13px]',
            !incidente.responsavel && 'text-texto-3 italic',
            meu && 'font-semibold',
          )}
        >
          {incidente.responsavel ? (meu ? 'Você' : incidente.responsavel.nome) : 'Sem responsável'}
        </span>

        <span role="cell">
          <AcoesLinha
            incidente={incidente}
            idAnalista={idAnalista}
            pendente={pendente}
            semConexao={semConexao}
            aoExecutar={aoExecutar}
          />
        </span>

      </div>
      {conflito && (
        <div role="row">
          <div role="cell" aria-colspan={8}>
            <AvisoConflito
              conflito={conflito}
              incidente={incidente}
              idAnalista={idAnalista}
              aoManter={aoDispensarConflito}
              aoRefazer={() => aoExecutar(conflito.acao)}
            />
          </div>
        </div>
      )}

      {aberta && (
        <div role="row">
          <div role="cell" aria-colspan={8}>
            <div
              id={idDetalhes}
              role="group"
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
              <div className="flex justify-end gap-2 border-t pt-3 sm:col-span-3">
                <BotaoComMotivo
                  motivo={motivoAlterar}
                  rotulo={`Editar #${incidente.id}`}
                  onClick={aoEditar}
                  className="flex items-center gap-1.5 px-3 font-medium"
                >
                  <Pencil aria-hidden className="size-3.5" />
                  Editar
                </BotaoComMotivo>
                <BotaoComMotivo
                  motivo={motivoAlterar}
                  rotulo={`Remover #${incidente.id}`}
                  onClick={aoRemover}
                  className="flex items-center gap-1.5 px-3 font-medium text-erro-texto"
                >
                  <Trash2 aria-hidden className="size-3.5" />
                  Remover
                </BotaoComMotivo>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
