import type { ReactNode } from 'react'
import type { AnalistaLogado } from '@/api/tipos'
import { BotaoTema } from '@/components/BotaoTema'
import { MarcaLogos } from '@/components/MarcaLogos'
import { Button } from '@/components/ui/button'
import { IndicadorConexao } from './IndicadorConexao'
import type { EstadoConexao } from './useIncidentes'

interface Props {
  analista: AnalistaLogado
  estado: EstadoConexao
  atualizadoEm: number
  aoSair: () => void
  /** Campo de busca, entre o indicador de conexão e o perfil. */
  busca?: ReactNode
}

function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/)
  return ((partes[0]?.[0] ?? '') + (partes.length > 1 ? partes.at(-1)![0] : '')).toUpperCase()
}

export function CabecalhoTriagem({ analista, estado, atualizadoEm, aoSair, busca }: Props) {
  return (
    <header className="flex flex-wrap items-center gap-x-6 gap-y-2.5 border-b bg-card px-4 py-2.5 sm:px-6">
      <MarcaLogos />
      <IndicadorConexao estado={estado} atualizadoEm={atualizadoEm} />
      {busca}
      <div className="ml-auto flex items-center gap-3">
        <BotaoTema compacto />
        <div className="flex items-center gap-2.5">
          <span
            aria-hidden
            className="flex size-8 items-center justify-center rounded-full border bg-superficie-2 text-xs font-semibold"
          >
            {iniciais(analista.nome)}
          </span>
          <span className="flex flex-col leading-tight max-sm:hidden">
            <span className="text-sm font-medium">{analista.nome}</span>
            <span className="text-xs text-texto-3">Analista</span>
          </span>
        </div>
        <Button
          type="button"
          variant="link"
          onClick={aoSair}
          className="h-auto px-0 text-sm text-texto-2 underline underline-offset-3"
        >
          Sair
        </Button>
      </div>
    </header>
  )
}
