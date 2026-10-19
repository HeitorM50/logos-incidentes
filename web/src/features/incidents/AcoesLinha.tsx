import { ChevronDown } from 'lucide-react'
import { useId, useRef, useState, type ReactNode, type Ref } from 'react'
import { ROTULO_STATUS } from '@/api/rotulos'
import type { Incidente, StatusIncidente } from '@/api/tipos'
import { LogosLoader } from '@/components/LogosLoader'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { motivoBloqueio, TRANSICOES_DO_RESPONSAVEL, textoPendente, type Acao } from './acoes'

const SEM_CONEXAO = 'Sem conexão com o servidor. As ações voltam quando a conexão voltar.'
const EM_ANDAMENTO = 'Aguarde: há uma ação em andamento neste incidente.'

const CONTROLE =
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
function BotaoComMotivo({ ref, motivo, rotulo, className, onClick, children }: PropsBotao) {
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

/** Motivo para não abrir o menu de status, ou null quando o analista pode mudar. */
function motivoStatus(incidente: Incidente, idAnalista: number): string | null {
  const opcoes = TRANSICOES_DO_RESPONSAVEL[incidente.status]
  // Testa a regra com um destino válido (ou qualquer um): o motivo é o mesmo para todos.
  const motivo = motivoBloqueio(
    incidente,
    { tipo: 'status', status: opcoes?.[0] ?? 'fechado' },
    idAnalista,
  )
  if (motivo || opcoes) return motivo
  return `A partir de ${ROTULO_STATUS[incidente.status]} não há outro status disponível.`
}

interface Props {
  incidente: Incidente
  idAnalista: number
  /** Ação em andamento nesta linha. */
  pendente?: Acao
  semConexao: boolean
  aoExecutar: (acao: Acao) => void
}

export function AcoesLinha({ incidente, idAnalista, pendente, semConexao, aoExecutar }: Props) {
  const [confirmarFechar, setConfirmarFechar] = useState(false)
  // O menu e o diálogo devolvem o foco ao gatilho, mas ele sai da tela durante a ação: o
  // foco vai para o botão principal, que nunca desmonta.
  const principal = useRef<HTMLButtonElement>(null)
  const escolheu = useRef(false)

  const meu = incidente.responsavel?.id === idAnalista
  const acaoBotao: Acao = meu ? { tipo: 'liberar' } : { tipo: 'assumir' }
  const nomeBotao = meu ? 'Liberar' : 'Assumir'
  const bloqueioGeral = pendente ? EM_ANDAMENTO : semConexao ? SEM_CONEXAO : null
  const motivoBotao = bloqueioGeral ?? motivoBloqueio(incidente, acaoBotao, idAnalista)
  const motivoMenu = bloqueioGeral ?? motivoStatus(incidente, idAnalista)
  const rotuloStatus = `Mudar status de #${incidente.id}`

  function escolher(status: StatusIncidente) {
    // Fechado é final: pede confirmação antes de chamar a API.
    if (status === 'fechado') setConfirmarFechar(true)
    else aoExecutar({ tipo: 'status', status })
  }

  // Os dois controles ficam montados durante a ação: trocar o nó focado por outro jogaria o
  // foco do teclado para o topo da página. O andamento aparece no lugar do menu de status.
  return (
    <span className="flex items-center gap-2">
      <BotaoComMotivo
        ref={principal}
        motivo={motivoBotao}
        rotulo={`${nomeBotao} #${incidente.id}`}
        onClick={() => aoExecutar(acaoBotao)}
        className="w-[84px] font-medium"
      >
        {nomeBotao}
      </BotaoComMotivo>

      {pendente ? (
        <span
          aria-hidden
          className="inline-flex h-8 w-[140px] items-center gap-2 rounded-[5px] border border-dashed border-borda-forte px-2 text-[13px] font-medium whitespace-nowrap"
        >
          <LogosLoader tamanho={14} decorativo fundo="var(--linha-pendente)" />
          {textoPendente(pendente)}
        </span>
      ) : motivoMenu ? (
        <BotaoComMotivo
          motivo={motivoMenu}
          rotulo={rotuloStatus}
          className="flex w-[140px] items-center justify-between px-2 text-left"
        >
          Mudar status
          <ChevronDown aria-hidden className="size-3.5" />
        </BotaoComMotivo>
      ) : (
        // Menu, e não <select>: no select a seta do teclado já dispara a mudança.
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label={rotuloStatus}
              className={cn(
                CONTROLE,
                'flex w-[140px] cursor-pointer items-center justify-between px-2 text-left hover:bg-superficie-2',
              )}
            >
              Mudar status
              <ChevronDown aria-hidden className="size-3.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="min-w-[160px]"
            onCloseAutoFocus={(evento) => {
              if (!escolheu.current) return
              escolheu.current = false
              evento.preventDefault()
              principal.current?.focus()
            }}
          >
            {(TRANSICOES_DO_RESPONSAVEL[incidente.status] ?? []).map((status) => (
              <DropdownMenuItem
                key={status}
                onSelect={() => {
                  escolheu.current = true
                  escolher(status)
                }}
              >
                {ROTULO_STATUS[status]}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      <AlertDialog open={confirmarFechar} onOpenChange={setConfirmarFechar}>
        <AlertDialogContent
          onCloseAutoFocus={(evento) => {
            evento.preventDefault()
            principal.current?.focus()
          }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle>Fechar o incidente #{incidente.id}?</AlertDialogTitle>
            <AlertDialogDescription>
              {incidente.titulo}. Fechado é o estado final: o incidente não aceita mais
              alterações e não volta a ser aberto.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => aoExecutar({ tipo: 'status', status: 'fechado' })}>
              Fechar incidente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </span>
  )
}
