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
      onClick={alternarTema}
      aria-label={claro ? 'Ativar modo escuro' : 'Ativar modo claro'}
      title={compacto ? (claro ? 'Modo escuro' : 'Modo claro') : undefined}
      className={cn(
        'gap-2 rounded-md bg-card text-sm dark:bg-card',
        compacto ? 'size-9 px-0' : 'h-10 px-3.5',
      )}
    >
      {claro ? <Moon aria-hidden /> : <Sun aria-hidden />}
      {!compacto && <span>{claro ? 'Modo escuro' : 'Modo claro'}</span>}
    </Button>
  )
}
