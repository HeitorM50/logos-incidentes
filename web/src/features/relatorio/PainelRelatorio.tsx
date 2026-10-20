import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { lazy, Suspense, useId, useState } from 'react'
import { obterRelatorio, PERIODOS_HORAS, type PeriodoHoras } from '@/api/relatorio'
import { LogosLoader } from '@/components/LogosLoader'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'

// Painel lateral do relatório, aberto pelo botão "Relatório" da triagem: a lista continua
// no topo, e o resumo da central fica a um clique. O conteúdo (com os gráficos) é carregado
// só quando o painel abre.
const ConteudoRelatorio = lazy(() => import('./ConteudoRelatorio'))

const ROTULO_PERIODO: Record<PeriodoHoras, string> = {
  6: 'Últimas 6 horas',
  24: 'Últimas 24 horas',
  168: 'Últimos 7 dias',
}

function Carregando({ texto }: { texto: string }) {
  return (
    <p role="status" className="flex items-center justify-center gap-2 py-16 text-sm text-texto-2">
      <LogosLoader tamanho={20} decorativo fundo="var(--background)" />
      {texto}
    </p>
  )
}

interface Props {
  aberto: boolean
  aoMudar: (aberto: boolean) => void
}

export function PainelRelatorio({ aberto, aoMudar }: Props) {
  const idPeriodo = useId()
  // 6 h por padrão: os dados de demonstração cobrem poucas horas, e o período anterior também
  // tem incidentes para comparar.
  const [horas, setHoras] = useState<PeriodoHoras>(6)
  const consulta = useQuery({
    queryKey: ['relatorio', horas],
    queryFn: ({ signal }) => obterRelatorio(horas, signal),
    enabled: aberto,
    refetchInterval: aberto ? 30_000 : false,
    placeholderData: keepPreviousData,
  })

  return (
    <Sheet open={aberto} onOpenChange={aoMudar}>
      <SheetContent
        side="right"
        className="gap-0 data-[side=right]:w-full data-[side=right]:sm:max-w-[520px]"
      >
        <SheetHeader className="flex-row flex-wrap items-center justify-between gap-3 border-b px-5 py-4 pr-12">
          <div className="flex flex-col gap-0.5">
            <SheetTitle className="text-xl font-semibold">Relatório de incidentes</SheetTitle>
            <SheetDescription className="text-texto-2">
              Atendimento da frota, comparado com o período anterior.
            </SheetDescription>
          </div>
          <label htmlFor={idPeriodo} className="sr-only">
            Período
          </label>
          <select
            id={idPeriodo}
            value={horas}
            onChange={(e) => setHoras(Number(e.target.value) as PeriodoHoras)}
            className="h-9 rounded-full border-0 bg-pilula px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {PERIODOS_HORAS.map((p) => (
              <option key={p} value={p}>
                {ROTULO_PERIODO[p]}
              </option>
            ))}
          </select>
        </SheetHeader>
        <div
          className="min-h-0 flex-1 overflow-y-auto px-5 py-5"
          aria-busy={consulta.isFetching}
        >
          {consulta.data ? (
            <Suspense fallback={<Carregando texto="Preparando os gráficos…" />}>
              <ConteudoRelatorio relatorio={consulta.data} />
            </Suspense>
          ) : consulta.isError ? (
            <div role="alert" className="flex flex-col items-center gap-3 py-16 text-sm text-texto-2">
              Não foi possível carregar o relatório.
              <button
                type="button"
                onClick={() => void consulta.refetch()}
                className="apertar h-9 cursor-pointer rounded-full bg-pilula px-4 font-medium text-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                Tentar de novo
              </button>
            </div>
          ) : (
            <Carregando texto="Carregando o relatório…" />
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
