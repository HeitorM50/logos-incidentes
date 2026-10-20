import { AlarmClock, Check, UserRound } from 'lucide-react'
import { ROTULO_CATEGORIA } from '@/api/rotulos'
import { CATEGORIAS, type Categoria } from '@/api/tipos'
import { cn } from '@/lib/utils'
import type { Situacao } from './filtros'
import { quantosNaSituacao } from './resumo'

interface Props {
  /** Quantos cada categoria mostraria; null enquanto a primeira leitura não chegou. */
  contagem: Record<Categoria, number> | null
  /** A situação escolhida (ativos, fechados, todos): define a palavra do número. */
  situacao: Situacao
  selecionadas: Categoria[]
  aoAlternar: (categoria: Categoria) => void
  /** "Minha fila": incidentes atribuídos ao analista (null antes da primeira leitura). */
  minhaFila: { marcada: boolean; contagem: number | null; aoAlternar: () => void }
  /** "Atrasados": ativos sem responsável além do prazo (null antes da primeira leitura). */
  atrasados: { marcada: boolean; contagem: number | null; aoAlternar: () => void }
  /** Aparece só com algum filtro ativo (criticidade, categoria, minha fila ou busca). */
  aoLimpar?: () => void
}

const CHIP =
  'flex h-9 cursor-pointer items-center gap-2 rounded-md border px-3 text-[13px] font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50'
const CHIP_MARCADO = 'border-primary bg-primary text-primary-foreground'
const CHIP_LIVRE = 'border-borda-forte bg-card text-foreground hover:bg-superficie-2'

export function FiltroCategorias({
  contagem,
  situacao,
  selecionadas,
  aoAlternar,
  minhaFila,
  atrasados,
  aoLimpar,
}: Props) {
  const haAtrasados = !!atrasados.contagem
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
              aria-label={contagem ? `${rotulo}, ${quantosNaSituacao(contagem[categoria], situacao)}` : rotulo}
              onClick={() => aoAlternar(categoria)}
              className={cn(CHIP, marcada ? CHIP_MARCADO : CHIP_LIVRE)}
            >
              {marcada && <Check
                  aria-hidden
                  className="size-3 animate-in duration-200 zoom-in-50 fade-in-0"
                  strokeWidth={3}
                />}
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
      {/* Separador visual: "Minha fila" não é uma categoria. */}
      <span aria-hidden className="mx-1 h-6 w-px bg-border" />
      <button
        type="button"
        aria-pressed={minhaFila.marcada}
        aria-label={
          minhaFila.contagem === null
            ? 'Atribuídos a mim'
            : `Atribuídos a mim, ${quantosNaSituacao(minhaFila.contagem, situacao)}`
        }
        onClick={minhaFila.aoAlternar}
        className={cn(CHIP, minhaFila.marcada ? CHIP_MARCADO : CHIP_LIVRE)}
      >
        {minhaFila.marcada ? (
          <Check
                  aria-hidden
                  className="size-3 animate-in duration-200 zoom-in-50 fade-in-0"
                  strokeWidth={3}
                />
        ) : (
          <UserRound aria-hidden className="size-3.5" />
        )}
        Atribuídos a mim
        <span
          className={cn(
            'font-mono text-xs tabular-nums',
            minhaFila.marcada ? 'opacity-85' : 'text-texto-2',
          )}
        >
          {minhaFila.contagem ?? '–'}
        </span>
      </button>
      <button
        type="button"
        aria-pressed={atrasados.marcada}
        aria-label={
          atrasados.contagem === null
            ? 'Atrasados'
            : `Atrasados, ${atrasados.contagem} sem responsável além do prazo`
        }
        title="Ativos sem responsável além do prazo para assumir (Alta 15 min, Média 60, Baixa 240)"
        onClick={atrasados.aoAlternar}
        className={cn(
          CHIP,
          atrasados.marcada
            ? CHIP_MARCADO
            : haAtrasados
              ? // Com atrasados, o botão chama atenção (borda e texto de erro), não só pela cor:
                // o ícone e o número em negrito dizem o mesmo.
                'border-erro-borda bg-card text-erro-texto hover:bg-superficie-2'
              : CHIP_LIVRE,
        )}
      >
        {atrasados.marcada ? (
          <Check
            aria-hidden
            className="size-3 animate-in duration-200 zoom-in-50 fade-in-0"
            strokeWidth={3}
          />
        ) : (
          <AlarmClock aria-hidden className="size-3.5" />
        )}
        Atrasados
        <span
          className={cn(
            'font-mono text-xs tabular-nums',
            atrasados.marcada ? 'opacity-85' : haAtrasados ? 'font-bold' : 'text-texto-2',
          )}
        >
          {atrasados.contagem ?? '–'}
        </span>
      </button>
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
