import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { obterMapaDaFrota, type VeiculoNoMapa } from '@/api/frota'
import { ROTULO_CRITICIDADE } from '@/api/rotulos'
import type { Criticidade } from '@/api/tipos'
import { LogosLoader } from '@/components/LogosLoader'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { useAgora } from '@/lib/useAgora'
import { cn } from '@/lib/utils'
import { formatarSegundosAtras } from '@/features/incidents/tempo'
import { MapaFrota } from './MapaFrota'
import {
  ORDEM_SITUACAO,
  ordenarVeiculos,
  ROTULO_SITUACAO,
  situacaoDoVeiculo,
  type SituacaoVeiculo,
} from './situacao'

// Tela "Frota" (opção D): onde cada caminhão está, pela telemetria da central de rastreamento.
// O mapa é o resumo visual; a lista é a versão acessível e o caminho até cada incidente.

/** Forma + texto da situação: legível sem depender da cor. */
function MarcaSituacao({
  situacao,
  criticidade,
}: {
  situacao: SituacaoVeiculo
  criticidade?: Criticidade
}) {
  const corAlerta = {
    alta: 'bg-alta-borda ring-alta-borda/30',
    media: 'bg-media-borda ring-media-borda/30',
    baixa: 'bg-baixa-borda ring-baixa-borda/30',
  }[criticidade ?? 'alta']
  const forma = {
    incidente: `size-3 rounded-full ring-2 ${corAlerta}`,
    parado: 'size-2.5 rounded-[2px] bg-media-borda',
    movimento: 'size-2.5 rounded-full bg-foreground',
    patio: 'size-2.5 rounded-full border-[1.5px] border-texto-3 bg-card',
    sem_sinal: 'size-2.5 rounded-full border-[1.5px] border-dashed border-texto-3',
  }[situacao]
  return <span aria-hidden className={cn('inline-block flex-none', forma)} />
}

interface Props {
  aberto: boolean
  aoMudar: (aberto: boolean) => void
  aoVerIncidente: (id: number) => void
}

export function PainelFrota({ aberto, aoMudar, aoVerIncidente }: Props) {
  const consulta = useQuery({
    queryKey: ['frota'],
    queryFn: ({ signal }) => obterMapaDaFrota(signal),
    enabled: aberto,
    refetchInterval: aberto ? 15_000 : false,
    placeholderData: keepPreviousData,
  })
  const agora = useAgora(5_000)
  const mapa = consulta.data
  const contagem = Object.fromEntries(ORDEM_SITUACAO.map((s) => [s, 0])) as Record<
    SituacaoVeiculo,
    number
  >
  for (const veiculo of mapa?.veiculos ?? []) contagem[situacaoDoVeiculo(veiculo)]++
  const ultimaLeitura = Math.max(
    0,
    ...(mapa?.veiculos ?? []).map((v) => (v.ultima_leitura_em ? Date.parse(v.ultima_leitura_em) : 0)),
  )

  function verIncidente(id: number) {
    aoMudar(false)
    aoVerIncidente(id)
  }

  return (
    <Sheet open={aberto} onOpenChange={aoMudar}>
      <SheetContent
        side="right"
        className="gap-0 data-[side=right]:w-full data-[side=right]:lg:max-w-[1040px] data-[side=right]:sm:max-w-[720px]"
      >
        <SheetHeader className="border-b px-5 py-4 pr-12">
          <SheetTitle className="text-xl font-semibold">Frota</SheetTitle>
          <SheetDescription className="text-texto-2">
            Onde está cada caminhão, pela telemetria da central de rastreamento
            {ultimaLeitura ? ` · última leitura ${formatarSegundosAtras(Math.max(0, Math.round((agora - ultimaLeitura) / 1000)))}` : ''}
            . Os incidentes da telemetria nascem dos sinais: pânico, impacto, motor quente,
            visibilidade baixa e parada longa.
          </SheetDescription>
        </SheetHeader>

        {!mapa ? (
          consulta.isError ? (
            <p role="alert" className="py-16 text-center text-sm text-texto-2">
              Não foi possível carregar a frota.
            </p>
          ) : (
            <p role="status" className="flex items-center justify-center gap-2 py-16 text-sm text-texto-2">
              <LogosLoader tamanho={20} decorativo fundo="var(--background)" />
              Carregando a frota…
            </p>
          )
        ) : (
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 py-4 lg:flex-row">
            <div className="flex flex-col gap-3 lg:w-[46%] lg:flex-none">
              <ul aria-label="Resumo da frota" className="flex flex-wrap gap-x-4 gap-y-1.5 text-[13px]">
                {ORDEM_SITUACAO.filter((s) => s !== 'sem_sinal' || contagem.sem_sinal).map((s) => (
                  <li key={s} className="flex items-center gap-1.5">
                    <MarcaSituacao situacao={s} />
                    {ROTULO_SITUACAO[s]}
                    <span className="font-mono font-semibold tabular-nums">{contagem[s]}</span>
                  </li>
                ))}
              </ul>
              <div className="aspect-[17/20] w-full">
                <MapaFrota mapa={mapa} aoVerIncidente={verIncidente} />
              </div>
            </div>

            <table className="w-full min-w-0 border-collapse text-[13px] lg:flex-1">
              <caption className="sr-only">Caminhões da frota, os que pedem atenção primeiro</caption>
              <thead>
                <tr className="border-b text-left text-[11.5px] tracking-[0.05em] text-texto-3 uppercase">
                  <th className="py-2 pr-2 font-semibold">Caminhão</th>
                  <th className="py-2 pr-2 font-semibold">Onde</th>
                  <th className="py-2 pr-2 font-semibold">Situação</th>
                </tr>
              </thead>
              <tbody>
                {ordenarVeiculos(mapa.veiculos).map((veiculo) => (
                  <LinhaVeiculo key={veiculo.placa} veiculo={veiculo} aoVerIncidente={verIncidente} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}

function LinhaVeiculo({
  veiculo,
  aoVerIncidente,
}: {
  veiculo: VeiculoNoMapa
  aoVerIncidente: (id: number) => void
}) {
  const situacao = situacaoDoVeiculo(veiculo)
  return (
    <tr className="border-b align-top last:border-b-0">
      <td className="py-2 pr-2">
        <span className="block font-mono font-semibold">{veiculo.placa}</span>
        <span className="block text-texto-3">{veiculo.motorista ?? 'Sem motorista'}</span>
      </td>
      <td className="py-2 pr-2 text-texto-2">{veiculo.referencia ?? '—'}</td>
      <td className="py-2">
        <span className="flex items-center gap-1.5">
          <MarcaSituacao situacao={situacao} criticidade={veiculo.incidente?.criticidade} />
          {situacao === 'movimento'
            ? `${veiculo.velocidade_kmh} km/h`
            : situacao === 'incidente'
              ? ROTULO_CRITICIDADE[veiculo.incidente!.criticidade]
              : ROTULO_SITUACAO[situacao]}
        </span>
        {veiculo.incidente && (
          <button
            type="button"
            onClick={() => aoVerIncidente(veiculo.incidente!.id)}
            className="mt-1 cursor-pointer rounded-sm text-left font-medium underline underline-offset-3 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            #{veiculo.incidente.id} {veiculo.incidente.titulo}
          </button>
        )}
      </td>
    </tr>
  )
}
