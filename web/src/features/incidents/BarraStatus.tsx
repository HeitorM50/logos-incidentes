import { useEffect, useState } from 'react'
import { ROTULO_STATUS } from '@/api/rotulos'
import { cn } from '@/lib/utils'
import { STATUS_ATIVOS, type StatusAtivo } from './resumo'

// Inconclusivo usa listras além da cor: os três tons de cinza ficam distintos sem depender
// só da cor (ADR 0004).
const COR_SEGMENTO: Record<StatusAtivo, string> = {
  aberto: 'bg-seg-aberto',
  em_investigacao: 'bg-seg-investigacao',
  inconclusivo:
    'bg-seg-inconclusivo bg-[repeating-linear-gradient(135deg,transparent_0_3px,var(--card)_3px_5px)]',
}

interface Props {
  /** null enquanto a primeira leitura não chegou. */
  porStatus: Record<StatusAtivo, number> | null
}

export function BarraStatus({ porStatus }: Props) {
  // Primeira carga: os segmentos crescem da esquerda, em sequência (Aberto → Investigação →
  // Inconclusivo). Depois disso, mudam de tamanho sem atraso.
  const [cresceu, setCresceu] = useState(false)
  const [primeiraVez, setPrimeiraVez] = useState(true)
  useEffect(() => {
    if (!porStatus || cresceu) return
    const quadro = requestAnimationFrame(() => setCresceu(true))
    return () => cancelAnimationFrame(quadro)
  }, [porStatus, cresceu])
  useEffect(() => {
    if (!cresceu) return
    const id = setTimeout(() => setPrimeiraVez(false), 1_000)
    return () => clearTimeout(id)
  }, [cresceu])

  const total = porStatus ? STATUS_ATIVOS.reduce((soma, s) => soma + porStatus[s], 0) : 0
  const pct = (n: number) => (total ? Math.round((n / total) * 100) : 0)
  const descricao = porStatus
    ? STATUS_ATIVOS.map((s) => `${ROTULO_STATUS[s]}: ${porStatus[s]}`).join(', ')
    : 'Aguardando dados'

  return (
    <section aria-labelledby="titulo-ativos-status" className="flex flex-col gap-2">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2
          id="titulo-ativos-status"
          className="text-xs font-semibold tracking-[0.04em] text-texto-2 uppercase"
        >
          Ativos por status
        </h2>
        <ul className="flex flex-wrap gap-x-[18px] gap-y-1 text-[13px]">
          {STATUS_ATIVOS.map((status) => (
            <li key={status} className="flex items-center gap-1.5">
              <span
                aria-hidden
                className={cn(
                  'size-2.5 rounded-[2px]',
                  COR_SEGMENTO[status],
                  status === 'inconclusivo' && 'border border-borda-forte',
                )}
              />
              <span>{ROTULO_STATUS[status]}</span>
              <span className="font-mono font-semibold tabular-nums">
                {porStatus ? porStatus[status] : '–'}
              </span>
              {porStatus && (
                <span className="font-mono text-xs text-texto-3">{pct(porStatus[status])}%</span>
              )}
            </li>
          ))}
        </ul>
      </div>
      <div
        role="img"
        aria-label={descricao}
        className="group flex h-2.5 gap-0.5 overflow-hidden rounded-[3px] bg-esqueleto"
      >
        {porStatus &&
          STATUS_ATIVOS.map((status, i) =>
            porStatus[status] ? (
              <span
                key={status}
                // Mouse sobre um segmento: os outros recuam e o título mostra a contagem.
                title={`${ROTULO_STATUS[status]}: ${porStatus[status]} (${pct(porStatus[status])}%)`}
                className={cn(
                  'min-w-1 transition-[flex-grow,opacity] duration-500 group-hover:opacity-40 hover:opacity-100!',
                  COR_SEGMENTO[status],
                )}
                style={{
                  flex: `${cresceu ? porStatus[status] : 0} 1 0`,
                  transitionDelay: primeiraVez ? `${i * 120}ms` : undefined,
                }}
              />
            ) : null,
          )}
      </div>
    </section>
  )
}
