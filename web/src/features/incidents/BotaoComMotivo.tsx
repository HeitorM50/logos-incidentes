import { useId, useState, type ReactNode, type Ref } from 'react'
import { cn } from '@/lib/utils'

export const CONTROLE =
  'h-8 rounded-[5px] border border-borda-forte bg-card text-[13px] outline-none focus-visible:ring-3 focus-visible:ring-ring/50'

interface PropsBotao {
  ref?: Ref<HTMLButtonElement>
  /** Motivo do bloqueio; null libera o botão. */
  motivo: string | null
  rotulo: string
  className?: string
  onClick?: () => void
  children: ReactNode
}

/**
 * Botão que, bloqueado, continua focável e diz o motivo (decisão de 19/10: ação que só o
 * responsável pode fazer aparece desativada com o motivo). `disabled` tiraria o botão do Tab
 * e o leitor de tela nunca ouviria a explicação. O motivo aparece no foco, no mouse e no
 * toque (clique), e some com Esc.
 */
export function BotaoComMotivo({ ref, motivo, rotulo, className, onClick, children }: PropsBotao) {
  const idMotivo = useId()
  const [mostrar, setMostrar] = useState(false)
  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => setMostrar(true)}
      onMouseLeave={() => setMostrar(false)}
    >
      <button
        ref={ref}
        type="button"
        aria-label={rotulo}
        aria-disabled={motivo ? true : undefined}
        aria-describedby={motivo ? idMotivo : undefined}
        onClick={motivo ? () => setMostrar(true) : onClick}
        onFocus={() => setMostrar(true)}
        onBlur={() => setMostrar(false)}
        onKeyDown={(evento) => {
          if (evento.key === 'Escape' && mostrar && motivo) {
            evento.stopPropagation()
            setMostrar(false)
          }
        }}
        className={cn(
          CONTROLE,
          motivo ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:bg-superficie-2',
          className,
        )}
      >
        {children}
      </button>
      {motivo && (
        <span
          id={idMotivo}
          role="tooltip"
          hidden={!mostrar}
          className="pointer-events-none absolute right-0 bottom-full z-10 mb-1.5 w-max max-w-[260px] rounded-md bg-aviso-fundo px-2.5 py-1.5 text-xs leading-snug text-aviso-texto shadow-lg"
        >
          {motivo}
        </span>
      )}
    </span>
  )
}
