import { CircleHelp } from 'lucide-react'
import type { ReactNode } from 'react'
import type { AnalistaLogado } from '@/api/tipos'
import { BotaoTema } from '@/components/BotaoTema'
import { MarcaLogos } from '@/components/MarcaLogos'
import { Button } from '@/components/ui/button'
import { ID_BOTAO_AJUDA } from './useGuia'
import { IndicadorConexao } from './IndicadorConexao'
import type { EstadoConexao } from './useIncidentes'

interface Props {
  analista: AnalistaLogado
  estado: EstadoConexao
  atualizadoEm: number
  aoSair: () => void
  /** Campo de busca, entre o indicador de conexão e o perfil. */
  busca?: ReactNode
  aoAbrirAjuda: () => void
}

function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/)
  return ((partes[0]?.[0] ?? '') + (partes.length > 1 ? partes.at(-1)![0] : '')).toUpperCase()
}

export function CabecalhoTriagem({
  analista,
  estado,
  atualizadoEm,
  aoSair,
  busca,
  aoAbrirAjuda,
}: Props) {
  return (
    // Cabeçalho flutuante (protótipo de 20/10): cartão arredondado acima da página.
    <header className="mx-3 mt-3 flex flex-wrap items-center gap-x-5 gap-y-2.5 rounded-[20px] bg-card px-4 py-2.5 shadow-cartao sm:mx-4 sm:pl-[18px]">
      <MarcaLogos />
      <IndicadorConexao estado={estado} atualizadoEm={atualizadoEm} />
      {busca}
      <div className="ml-auto flex items-center gap-3">
        <Button
          id={ID_BOTAO_AJUDA}
          type="button"
          variant="outline"
          onClick={aoAbrirAjuda}
          aria-label="Como funciona a triagem"
          title="Como funciona a triagem"
          className="apertar size-[38px] rounded-full border-0 bg-pilula px-0 hover:bg-pilula dark:bg-pilula dark:hover:bg-pilula"
        >
          <CircleHelp aria-hidden />
        </Button>
        <BotaoTema compacto />
        <div className="flex items-center gap-2.5">
          <span
            aria-hidden
            className="flex size-9 items-center justify-center rounded-full bg-foreground text-xs font-semibold text-background"
          >
            {iniciais(analista.nome)}
          </span>
          <span className="flex flex-col leading-tight max-sm:hidden">
            <span className="text-sm font-medium">{analista.nome}</span>
            <span className="text-xs text-texto-3">
              {analista.papel === 'supervisor' ? 'Supervisor' : 'Analista'}
            </span>
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
