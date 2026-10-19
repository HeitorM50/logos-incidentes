import { Check } from 'lucide-react'
import { ROTULO_CATEGORIA } from '@/api/rotulos'
import { CATEGORIAS, type Categoria } from '@/api/tipos'
import { cn } from '@/lib/utils'
import { quantosAtivos } from './resumo'

interface Props {
  /** Ativos que cada categoria mostraria; null enquanto a primeira leitura não chegou. */
  contagem: Record<Categoria, number> | null
  selecionadas: Categoria[]
  aoAlternar: (categoria: Categoria) => void
  /** Aparece só com algum filtro ativo (criticidade, categoria ou busca). */
  aoLimpar?: () => void
}

export function FiltroCategorias({ contagem, selecionadas, aoAlternar, aoLimpar }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span id="titulo-categoria" className="mr-1 text-[13px] font-semibold text-texto-2">
        Categoria
      </span>
      <div role="group" aria-labelledby="titulo-categoria" className="flex flex-wrap gap-2">
        {CATEGORIAS.map((categoria) => {
          const marcada = selecionadas.includes(categoria)
          const rotulo = ROTULO_CATEGORIA[categoria]
          return (
            <button
              key={categoria}
              type="button"
              aria-pressed={marcada}
              // Nome explícito: sem ele o leitor de tela junta rótulo e número ("Vítimas1").
              aria-label={contagem ? `${rotulo}, ${quantosAtivos(contagem[categoria])}` : rotulo}
              onClick={() => aoAlternar(categoria)}
              className={cn(
                'flex h-9 cursor-pointer items-center gap-2 rounded-md border px-3 text-[13px] font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
                marcada
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-borda-forte bg-card text-foreground hover:bg-superficie-2',
              )}
            >
              {marcada && <Check aria-hidden className="size-3" strokeWidth={3} />}
              {rotulo}
              <span
                className={cn(
                  'font-mono text-xs tabular-nums',
                  marcada ? 'opacity-85' : 'text-texto-2',
                )}
              >
                {contagem ? contagem[categoria] : '–'}
              </span>
            </button>
          )
        })}
      </div>
      {aoLimpar && (
        <button
          type="button"
          onClick={aoLimpar}
          className="h-9 cursor-pointer rounded-md px-2.5 text-[13px] font-medium underline underline-offset-3 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          Limpar filtros
        </button>
      )}
    </div>
  )
}
