import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { listarEventos } from '@/api/incidentes'
import type { Incidente } from '@/api/tipos'
import { LogosLoader } from '@/components/LogosLoader'
import { cn } from '@/lib/utils'
import { descreverEvento } from './eventos'
import { formatarTempoAberto, minutosDesde } from './tempo'

// Histórico do incidente (desenho do protótipo): eventos gravados pela API na mesma transação
// de cada alteração. A chave inclui a versão: quando o incidente muda (por qualquer analista),
// a leitura de 5 s traz a versão nova e o histórico é relido sozinho.

const FORMATO_DATA = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

interface Props {
  incidente: Incidente
  idAnalista: number
  agora: number
}

export function HistoricoIncidente({ incidente, idAnalista, agora }: Props) {
  const consulta = useQuery({
    queryKey: ['eventos', incidente.id, incidente.versao],
    queryFn: ({ signal }) => listarEventos(incidente.id, signal),
    staleTime: Infinity, // muda só com a versão, que já está na chave
    // Com a versão nova, a lista anterior fica na tela até a nova chegar (sem piscar).
    placeholderData: keepPreviousData,
  })

  return (
    <div className="flex flex-col gap-2">
      <p
        id={`historico-${incidente.id}`}
        className="text-xs font-semibold tracking-[0.04em] text-texto-2 uppercase"
      >
        Histórico
      </p>
      {consulta.data ? (
        <ol aria-labelledby={`historico-${incidente.id}`} className="flex flex-col">
          {consulta.data.map((evento, i) => {
            const ultimo = i === consulta.data.length - 1
            return (
              <li
                key={evento.id}
                // Entrada em cascata (30 ms por evento, até 8): a linha do tempo "se desenha".
                style={{ animationDelay: `${Math.min(i, 8) * 30}ms` }}
                className="relative flex animate-in gap-3 pb-2.5 duration-300 fill-mode-backwards fade-in-0 slide-in-from-left-1 last:pb-0"
              >
                {/* Linha do tempo: ponto e traço até o próximo evento (decorativo). */}
                <span aria-hidden className="relative flex w-2 flex-none justify-center">
                  <span
                    className={cn(
                      'mt-[5px] size-2 rounded-full border-2',
                      ultimo ? 'border-foreground bg-foreground' : 'border-borda-forte bg-card',
                    )}
                  />
                  {!ultimo && (
                    <span className="absolute top-[15px] bottom-[-5px] w-px bg-borda-forte" />
                  )}
                </span>
                <span className="flex min-w-0 flex-col">
                  <span className={cn('leading-snug', ultimo && 'font-medium text-foreground')}>
                    {descreverEvento(evento, idAnalista)}
                  </span>
                  <time dateTime={evento.criado_em} className="font-mono text-xs text-texto-3">
                    {formatarTempoAberto(minutosDesde(evento.criado_em, agora))}
                    {' · '}
                    {FORMATO_DATA.format(new Date(evento.criado_em))}
                  </time>
                </span>
              </li>
            )
          })}
        </ol>
      ) : consulta.isError ? (
        <p role="alert" className="flex flex-wrap items-center gap-2 text-texto-2">
          Não foi possível carregar o histórico.
          <button
            type="button"
            onClick={() => void consulta.refetch()}
            className="cursor-pointer font-medium text-foreground underline underline-offset-3 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            Tentar de novo
          </button>
        </p>
      ) : (
        <p role="status" className="flex items-center gap-2 text-texto-2">
          <LogosLoader tamanho={16} decorativo fundo="var(--superficie-2)" />
          Carregando histórico…
        </p>
      )}
    </div>
  )
}
