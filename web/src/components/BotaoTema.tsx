import { Moon, Sun } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTema } from '@/theme/useTema'

export function BotaoTema() {
  const { tema, alternarTema } = useTema()
  const claro = tema === 'claro'

  return (
    <Button
      type="button"
      variant="outline"
      onClick={alternarTema}
      aria-label={claro ? 'Ativar modo escuro' : 'Ativar modo claro'}
      className="h-10 gap-2 rounded-md bg-card px-3.5 text-sm dark:bg-card"
    >
      {claro ? <Moon aria-hidden /> : <Sun aria-hidden />}
      <span>{claro ? 'Modo escuro' : 'Modo claro'}</span>
    </Button>
  )
}
