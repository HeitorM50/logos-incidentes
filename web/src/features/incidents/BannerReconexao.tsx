import { CircleCheck } from 'lucide-react'
import { LogosLoader } from '@/components/LogosLoader'
import { Button } from '@/components/ui/button'
import { useAgora } from '@/lib/useAgora'
import { formatarSegundosAtras } from './tempo'

interface Props {
  tentativas: number
  atualizadoEm: number
  aoTentarAgora: () => void
}

/** Aparece quando há dados na tela, mas as leituras recentes falharam. */
export function BannerReconexao({ tentativas, atualizadoEm, aoTentarAgora }: Props) {
  const agora = useAgora(1_000)
  const segundos = Math.max(0, Math.round((agora - atualizadoEm) / 1000))

  return (
    <div
      className="flex animate-in flex-wrap items-center gap-x-3 gap-y-2 border-b border-borda-forte bg-faixa px-4 py-2.5 text-sm duration-200 fade-in-0 slide-in-from-top-1 sm:px-6"
    >
      <LogosLoader tamanho={16} letreiro={false} decorativo fundo="var(--faixa)" />
      {/* Só o título é região viva; a linha de detalhe muda a cada segundo. */}
      <strong role="status" className="font-semibold">
        Conexão perdida. Reconectando…
      </strong>
      <span aria-hidden className="text-texto-2">
        {tentativas > 0 && `Tentativa ${tentativas} · `}última atualização{' '}
        {formatarSegundosAtras(segundos)}. A lista pode estar desatualizada.
      </span>
      <Button
        type="button"
        variant="outline"
        onClick={aoTentarAgora}
        className="ml-auto h-8 rounded-md border-borda-forte bg-card px-3 text-[13px] dark:border-borda-forte dark:bg-card"
      >
        Tentar agora
      </Button>
    </div>
  )
}

/** Fecha o ciclo da queda com um estado positivo: some sozinho depois de alguns segundos. */
export function AvisoReconectado() {
  return (
    <div className="flex animate-in items-center gap-2 border-b border-borda-forte bg-faixa px-4 py-2 text-sm duration-200 fade-in-0 slide-in-from-top-1 sm:px-6">
      <CircleCheck aria-hidden className="size-4 text-ao-vivo" />
      <strong className="font-semibold">Conexão restabelecida.</strong>
      <span className="text-texto-2">A lista está ao vivo de novo.</span>
    </div>
  )
}

