import { BookOpen, X } from 'lucide-react'
import { useRef, type ReactNode } from 'react'
import { CRITICIDADES } from '@/api/tipos'
import { ROTULO_CRITICIDADE } from '@/api/rotulos'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import { IconeCriticidade } from './Icones'
import { ID_BOTAO_AJUDA } from './useGuia'

// O case pede uso "sem dependência de instruções externas": o guia explica a triagem dentro
// do próprio app, com as regras reais (as mesmas de acoes.ts e da API).

const SELO = {
  alta: 'bg-alta-fundo text-alta-texto border-alta-borda font-bold',
  media: 'bg-media-fundo text-media-texto border-media-borda font-semibold',
  baixa: 'bg-baixa-fundo text-baixa-texto border-baixa-borda font-normal',
} as const

interface PropsDica {
  aoAbrir: () => void
  aoDispensar: () => void
}

export function DicaPrimeiroAcesso({ aoAbrir, aoDispensar }: PropsDica) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-info-borda bg-info-fundo px-3.5 py-2 text-[13px] text-info-texto">
      <BookOpen aria-hidden className="size-4 flex-none" />
      <span className="flex-1">
        <strong className="font-semibold">Primeira vez por aqui?</strong> Veja em 1 minuto como
        a triagem funciona.
      </span>
      <button
        type="button"
        onClick={aoAbrir}
        className="h-8 cursor-pointer rounded-[5px] border border-info-botao bg-info-botao px-3 font-semibold text-info-sobre-botao outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        Ver guia
      </button>
      <button
        type="button"
        aria-label="Dispensar a dica"
        onClick={aoDispensar}
        className="flex size-8 cursor-pointer items-center justify-center rounded-[5px] outline-none hover:bg-info-borda/20 focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <X aria-hidden className="size-3.5" />
      </button>
    </div>
  )
}

function Secao({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold">{titulo}</h3>
      <div className="flex flex-col gap-2 text-[13px] leading-relaxed text-texto-2">{children}</div>
    </section>
  )
}

interface PropsGuia {
  aberto: boolean
  aoMudar: (aberto: boolean) => void
}

export function GuiaTriagem({ aberto, aoMudar }: PropsGuia) {
  // Abre sem SheetTrigger: guarda quem abriu. Se foi a dica (que some ao abrir), o foco vai
  // para o botão de ajuda do cabeçalho.
  const quemAbriu = useRef<HTMLElement | null>(null)
  return (
    <Sheet open={aberto} onOpenChange={aoMudar}>
      <SheetContent
        onOpenAutoFocus={() => {
          quemAbriu.current = document.activeElement as HTMLElement | null
        }}
        onCloseAutoFocus={(evento) => {
          evento.preventDefault()
          // Aberto pela dica, o foco já estava no body quando o guia montou (a dica some
          // no mesmo render).
          const abriu = quemAbriu.current
          const destino =
            abriu?.isConnected && abriu !== document.body
              ? abriu
              : document.getElementById(ID_BOTAO_AJUDA)
          destino?.focus()
        }}
        side="right"
        className="gap-0 data-[side=right]:w-full data-[side=right]:sm:max-w-[440px]"
      >
        <SheetHeader className="border-b px-5 py-4 pr-12">
          <SheetTitle className="text-lg font-semibold">Como funciona a triagem</SheetTitle>
          <SheetDescription className="text-texto-2">
            O Logos mostra os incidentes da frota na ordem em que precisam de atenção.
          </SheetDescription>
        </SheetHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-5 py-4">
          <Secao titulo="1. O que atender primeiro">
            <p>
              A lista já vem ordenada: criticidade Alta primeiro e, dentro dela, o incidente aberto
              há mais tempo. A triagem mostra só os ativos; os fechados ficam em{' '}
              <strong className="font-semibold text-foreground">Fechados</strong>, acima da lista,
              com o fechado mais recente primeiro.
            </p>
            <p className="flex flex-wrap gap-2" aria-hidden>
              {CRITICIDADES.map((c) => (
                <span
                  key={c}
                  className={cn(
                    'inline-flex h-6 items-center gap-1.5 rounded-sm border px-2 text-xs tracking-[0.05em] uppercase',
                    SELO[c],
                  )}
                >
                  <IconeCriticidade criticidade={c} />
                  {ROTULO_CRITICIDADE[c]}
                </span>
              ))}
            </p>
            <p>
              A criticidade aparece por cor, ícone e peso da letra, para ser lida sem depender da
              cor.
            </p>
          </Secao>

          <Secao titulo="2. Filtrar o que importa agora">
            <p>
              Clique num cartão (Alta, Média, Baixa) ou numa categoria para ver só esses
              incidentes. <strong className="font-semibold text-foreground">Atribuídos a mim</strong>{' '}
              mostra a sua fila. O número em cada botão é quantos incidentes ativos ele mostra.
            </p>
            <p>
              A busca aceita título, local, placa ou <code className="font-mono">#número</code>.
              Atalho:{' '}
              <kbd className="rounded border bg-superficie-2 px-1 font-mono text-xs">Ctrl</kbd>+
              <kbd className="rounded border bg-superficie-2 px-1 font-mono text-xs">K</kbd> ou{' '}
              <kbd className="rounded border bg-superficie-2 px-1 font-mono text-xs">/</kbd>. Os
              filtros ficam no endereço da página: dá para recarregar ou enviar o link. Com o foco
              na seta de uma linha,{' '}
              <kbd className="rounded border bg-superficie-2 px-1 font-mono text-xs">↑</kbd> e{' '}
              <kbd className="rounded border bg-superficie-2 px-1 font-mono text-xs">↓</kbd> passam
              para a linha de cima ou de baixo.
            </p>
          </Secao>

          <Secao titulo="3. Tratar um incidente">
            <ol className="flex list-decimal flex-col gap-1.5 pl-5">
              <li>
                <strong className="font-semibold text-foreground">Assumir</strong>: você passa a ser
                o responsável e o incidente vai para Em Investigação.
              </li>
              <li>
                Só o responsável muda o status: Em Investigação, Inconclusivo ou Fechado.
                <strong className="font-semibold text-foreground"> Fechado é final</strong> e pede
                confirmação.
              </li>
              <li>
                <strong className="font-semibold text-foreground">Liberar</strong> devolve o
                incidente para a fila, para outro analista assumir.
              </li>
            </ol>
            <p>
              Para ver a descrição, a placa ou editar e remover, abra os detalhes pela seta no
              início da linha (no celular, pelo botão Detalhes do cartão). Um incidente novo entra por{' '}
              <strong className="font-semibold text-foreground">Novo incidente</strong>, ao lado do
              título.
            </p>
          </Secao>

          <Secao titulo="4. Trabalho em equipe">
            <p>
              A lista se atualiza sozinha a cada 5 segundos. Se outro analista alterar o mesmo
              incidente antes de você, o Logos avisa quem alterou e mostra a versão atual: nada é
              sobrescrito sem você ver.
            </p>
            <p>
              Botão desativado sempre diz o motivo ao passar o mouse, tocar ou focar com o teclado.
              Quando chega um incidente Alta novo, um aviso no canto leva até ele.
            </p>
          </Secao>

          <Secao titulo="5. Se a conexão oscilar">
            <p>
              A tela muda na hora quando você age. Se o servidor não confirmar, a linha volta ao
              estado anterior e um aviso oferece <em>Tentar de novo</em>. O topo da tela mostra se
              a lista está ao vivo, reconectando ou sem conexão.
            </p>
          </Secao>
        </div>
      </SheetContent>
    </Sheet>
  )
}
