import { Moon, Sun } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useTema } from '@/theme/useTema'

/** `compacto`: só o ícone (cabeçalho da triagem); o nome da ação fica no aria-label. */
export function BotaoTema({ compacto = false }: { compacto?: boolean }) {
  const { tema, alternarTema } = useTema()
  const claro = tema === 'claro'

  return (
    <Button
      type="button"
      variant="outline"
      onClick={(evento) => {
        // A troca se espalha em círculo a partir do centro do botão.
        const caixa = evento.currentTarget.getBoundingClientRect()
        alternarTema({ x: caixa.left + caixa.width / 2, y: caixa.top + caixa.height / 2 })
      }}
      aria-label={claro ? 'Ativar modo escuro' : 'Ativar modo claro'}
      title={compacto ? (claro ? 'Modo escuro' : 'Modo claro') : undefined}
      className={cn(
        'apertar gap-2 rounded-full border-0 bg-pilula text-sm hover:bg-pilula dark:bg-pilula dark:hover:bg-pilula',
        compacto ? 'size-[38px] px-0' : 'h-10 px-4',
      )}
    >
      {/* O ícone novo entra girando (a lua vira sol e o sol vira lua). */}
      {claro ? (
        <Moon key="lua" aria-hidden className="animate-in duration-300 spin-in-90 zoom-in-50" />
      ) : (
        <Sun key="sol" aria-hidden className="animate-in duration-300 spin-in-90 zoom-in-50" />
      )}
      {!compacto && <span>{claro ? 'Modo escuro' : 'Modo claro'}</span>}
    </Button>
  )
}
