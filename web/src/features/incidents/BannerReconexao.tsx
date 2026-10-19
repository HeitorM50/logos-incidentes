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
      className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-borda-forte bg-faixa px-4 py-2.5 text-sm sm:px-6"
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
