import { LogosLoader } from '@/components/LogosLoader'
import { useAgora } from '@/lib/useAgora'
import { formatarSegundosAtras } from './tempo'
import type { EstadoConexao } from './useIncidentes'

interface Props {
  estado: EstadoConexao
  /** Instante (ms) da última leitura bem-sucedida; 0 quando ainda não houve. */
  atualizadoEm: number
}

/** Pílula do cabeçalho: diz se a lista na tela está ao vivo ou desatualizada. */
export function IndicadorConexao({ estado, atualizadoEm }: Props) {
  const agora = useAgora(1_000)
  const segundos = Math.max(0, Math.round((agora - atualizadoEm) / 1000))

  return (
    <div
      role="status"
      className="flex h-[30px] items-center gap-2 rounded-full bg-pilula px-3 text-[13px] whitespace-nowrap text-texto-2"
    >
      {estado === 'ao_vivo' && (
        <>
          {/* O único loop da triagem: um anel discreto a cada 3 s diz "está vivo". */}
          <span aria-hidden className="relative flex size-2">
            <span className="absolute inset-0 animate-pulso-vivo rounded-full bg-ao-vivo" />
            <span className="relative size-2 rounded-full bg-ao-vivo" />
          </span>
          <span>
            <strong className="font-semibold text-foreground">Ao vivo</strong>
            {/* Fora da região viva: o contador muda a cada segundo e viraria ruído. */}
            <span aria-hidden> · atualizado {formatarSegundosAtras(segundos)}</span>
          </span>
        </>
      )}
      {(estado === 'sincronizando' || estado === 'reconectando') && (
        <>
          <LogosLoader tamanho={14} letreiro={false} decorativo fundo="var(--card)" />
          <strong className="font-semibold text-foreground">
            {estado === 'sincronizando' ? 'Sincronizando…' : 'Reconectando…'}
          </strong>
        </>
      )}
      {estado === 'sem_conexao' && (
        <>
          <span aria-hidden className="size-2 rounded-full border-[1.5px] border-current" />
          <span>Sem conexão</span>
        </>
      )}
    </div>
  )
}
