import { CircleCheck, CircleAlert } from 'lucide-react'
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

export function PainelAcordando({ segundos }: { segundos: number }) {
  return (
    <Painel>
      <div role="status" className="flex flex-col items-center gap-3">
        <LogosLoader tamanho={64} decorativo fundo="var(--card)" />
        <h2 className="text-lg font-semibold">Acordando o servidor…</h2>
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
      <CircleCheck aria-hidden className="size-8" strokeWidth={1.8} />
      <h2 className="text-lg font-semibold">Nenhum incidente ativo</h2>
      <p className="text-sm leading-normal text-texto-2">
        A frota não tem ocorrências abertas agora. Novos incidentes aparecem aqui automaticamente.
      </p>
    </Painel>
  )
}
