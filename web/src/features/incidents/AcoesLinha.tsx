import { ChevronDown } from 'lucide-react'
import { useRef, useState } from 'react'
import { ROTULO_STATUS } from '@/api/rotulos'
import type { Incidente, StatusIncidente } from '@/api/tipos'
import { LogosLoader } from '@/components/LogosLoader'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { BotaoComMotivo, CONTROLE } from './BotaoComMotivo'
import { motivoBloqueio, TRANSICOES_DO_RESPONSAVEL, textoPendente, type Acao } from './acoes'
import { DialogoComentario, type AcaoComComentario } from './DialogoComentario'

export const SEM_CONEXAO = 'Sem conexão com o servidor. As ações voltam quando a conexão voltar.'
export const EM_ANDAMENTO = 'Aguarde: há uma ação em andamento neste incidente.'

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
  // Fechar, marcar inconclusivo e liberar pedem comentário antes de chamar a API.
  const [pedido, setPedido] = useState<AcaoComComentario | null>(null)
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
    if (status === 'fechado' || status === 'inconclusivo') setPedido({ tipo: 'status', status })
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
        onClick={() => (meu ? setPedido({ tipo: 'liberar' }) : aoExecutar(acaoBotao))}
        // Liberar (o incidente é seu) fica contornado; Assumir, preenchido (protótipo de 20/10).
        className={cn(
          'w-[88px] font-semibold',
          meu && 'bg-transparent shadow-[inset_0_0_0_1.5px_var(--borda-forte)]',
        )}
      >
        {nomeBotao}
      </BotaoComMotivo>

      {pendente ? (
        <span
          aria-hidden
          className="inline-flex h-[34px] w-[140px] items-center gap-2 rounded-full border border-dashed border-borda-forte px-3 text-[13px] font-medium whitespace-nowrap"
        >
          <LogosLoader tamanho={14} decorativo fundo="var(--linha-pendente)" />
          {textoPendente(pendente)}
        </span>
      ) : motivoMenu ? (
        <BotaoComMotivo
          motivo={motivoMenu}
          rotulo={rotuloStatus}
          className="flex w-[140px] items-center justify-between px-3 text-left"
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
                'apertar flex w-[140px] cursor-pointer items-center justify-between px-3 text-left',
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

      <DialogoComentario
        incidente={incidente}
        acao={pedido}
        aoCancelar={() => setPedido(null)}
        aoConfirmar={(acao) => {
          setPedido(null)
          aoExecutar(acao)
        }}
        aoFecharFoco={() => principal.current?.focus()}
      />
    </span>
  )
}
