import { CircleAlert, Funnel } from 'lucide-react'
import type { ReactNode } from 'react'
import { LogosLoader } from '@/components/LogosLoader'
import { Button } from '@/components/ui/button'

// Painéis que ocupam a área da tabela quando não há linhas para mostrar.

function Painel({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-full items-center justify-center px-6 py-12">
      <div className="flex max-w-[520px] flex-col items-center gap-3 text-center">{children}</div>
    </div>
  )
}

interface PropsErro {
  mensagem: string
  /** Uma nova leitura está em andamento (automática ou pelo botão). */
  tentando: boolean
  aoTentar: () => void
}

export function PainelErro({ mensagem, tentando, aoTentar }: PropsErro) {
  return (
    <Painel>
      <div role="alert" className="flex flex-col items-center gap-3">
        <CircleAlert aria-hidden className="size-8" strokeWidth={1.8} />
        <h2 className="text-lg font-semibold">Não foi possível carregar os incidentes</h2>
        <p className="text-sm leading-normal text-texto-2">{mensagem}</p>
        <Button
          type="button"
          onClick={aoTentar}
          disabled={tentando}
          className="h-10 gap-2 rounded-md px-4"
        >
          {tentando && (
            <LogosLoader
              tamanho={16}
              decorativo
              cor="var(--primary-foreground)"
              fundo="var(--primary)"
            />
          )}
          {tentando ? 'Tentando…' : 'Tentar de novo'}
        </Button>
      </div>
    </Painel>
  )
}

function faseDaEspera(segundos: number): string {
  if (segundos < 15) return 'Ligando o servidor…'
  if (segundos < 35) {
    return 'Ainda iniciando: o primeiro acesso depois de um tempo parado é o mais lento.'
  }
  return 'Quase lá: a lista abre sozinha em instantes.'
}

export function PainelAcordando({ segundos }: { segundos: number }) {
  return (
    <Painel>
      <div role="status" className="flex flex-col items-center gap-3">
        <LogosLoader tamanho={64} decorativo fundo="var(--card)" />
        <h2 className="text-lg font-semibold">Acordando o servidor…</h2>
        {/* A frase muda com a espera: os 30 a 60 s do primeiro acesso não parecem travados. */}
        <p
          key={faseDaEspera(segundos)}
          className="animate-in text-sm font-medium duration-300 fade-in-0"
        >
          {faseDaEspera(segundos)}
        </p>
        <p className="text-sm leading-normal text-texto-2">
          O servidor estava em repouso e está iniciando. Isso costuma levar até 1 minuto; a lista
          abre sozinha assim que ele responder.
        </p>
        <p aria-hidden className="font-mono text-[13px] text-texto-3">
          Aguardando há {segundos} s
        </p>
      </div>
    </Painel>
  )
}

export function PainelVazio() {
  return (
    <Painel>
      {/* O ✓ se desenha: o momento de "tudo sob controle" do analista. */}
      <svg aria-hidden viewBox="0 0 24 24" className="size-8" fill="none" stroke="currentColor">
        <circle
          cx="12"
          cy="12"
          r="10"
          pathLength={1}
          strokeWidth={1.8}
          className="animate-[desenhar_500ms_ease-out_both] [stroke-dasharray:1]"
        />
        <path
          d="m8 12 3 3 5-6"
          pathLength={1}
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="animate-[desenhar_350ms_ease-out_350ms_both] [stroke-dasharray:1]"
        />
      </svg>
      <h2 className="text-lg font-semibold">Nenhum incidente ativo</h2>
      <p className="text-sm leading-normal text-texto-2">
        A frota não tem ocorrências abertas agora. Novos incidentes aparecem aqui automaticamente.
      </p>
    </Painel>
  )
}

interface PropsVazioFiltro {
  /** Ex.: "Criticidade Alta · Bloqueio de Pista · busca "br-116"". */
  descricao: string
  ativos: number
  aoLimpar: () => void
}

export function PainelVazioFiltro({ descricao, ativos, aoLimpar }: PropsVazioFiltro) {
  const quantos = `${ativos} ${ativos === 1 ? 'incidente ativo' : 'incidentes ativos'}`
  return (
    <Painel>
      <Funnel aria-hidden className="size-8" strokeWidth={1.8} />
      <h2 className="text-lg font-semibold">Nenhum incidente com estes filtros</h2>
      <p className="text-sm leading-normal text-texto-2">
        Filtro atual: {descricao}. Há {quantos} fora deste filtro.
      </p>
      <Button type="button" onClick={aoLimpar} className="mt-1 h-10 rounded-md px-[18px]">
        Limpar filtros
      </Button>
    </Painel>
  )
}
