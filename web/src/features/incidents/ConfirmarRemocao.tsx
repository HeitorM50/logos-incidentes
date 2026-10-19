import { CircleAlert } from 'lucide-react'
import { useRef, useState } from 'react'
import { ehErroApi } from '@/api/erros'
import type { AnalistaResumo, Incidente } from '@/api/tipos'
import { LogosLoader } from '@/components/LogosLoader'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { descreverEstado } from './acoes'
import { errosDaApi, motivoEdicao } from './formulario'
import type { Concluido } from './PainelIncidente'
import { useCrudIncidente } from './useCrudIncidente'

interface Props {
  /** Incidente a remover; null fecha o diálogo. */
  incidente: Incidente | null
  itens: Incidente[] | undefined
  analista: AnalistaResumo
  aoFechar: () => void
  aoConcluir: (concluido: Concluido) => void
  /** Para onde vai o foco depois da remoção (o botão que abriu o diálogo sumiu com a linha). */
  aoFocarDepois: () => void
}

export function ConfirmarRemocao({ incidente, ...resto }: Props) {
  // Guarda o último incidente para a animação de saída.
  const [ultimo, setUltimo] = useState(incidente)
  if (incidente && incidente !== ultimo) setUltimo(incidente)
  const exibido = incidente ?? ultimo
  const { remover } = useCrudIncidente()
  const removeu = useRef(false)
  // O diálogo abre sem AlertDialogTrigger: sem isto o Radix devolveria o foco ao body.
  const quemAbriu = useRef<HTMLElement | null>(null)

  return (
    <AlertDialog
      open={incidente !== null}
      onOpenChange={(abrir) => {
        // Durante a remoção o diálogo fica aberto: fechar esconderia o resultado.
        if (!abrir && !remover.isPending) resto.aoFechar()
      }}
    >
      {exibido && (
        <AlertDialogContent
          onOpenAutoFocus={() => {
            quemAbriu.current = document.activeElement as HTMLElement | null
          }}
          onCloseAutoFocus={(evento) => {
            evento.preventDefault()
            if (removeu.current || !quemAbriu.current?.isConnected) resto.aoFocarDepois()
            else quemAbriu.current.focus()
            removeu.current = false
          }}
        >
          <Conteudo
            key={exibido.id}
            aberto={exibido}
            remover={remover}
            aoRemovido={() => {
              removeu.current = true
            }}
            {...resto}
          />
        </AlertDialogContent>
      )}
    </AlertDialog>
  )
}

function Conteudo({
  aberto,
  itens,
  analista,
  aoFechar,
  aoConcluir,
  remover,
  aoRemovido,
}: Omit<Props, 'incidente' | 'aoFocarDepois'> & {
  aberto: Incidente
  remover: ReturnType<typeof useCrudIncidente>['remover']
  aoRemovido: () => void
}) {
  const [erro, setErro] = useState<string | null>(null)
  // A remoção envia a versão que o analista viu (controle otimista): se outra pessoa mudou o
  // incidente depois, a API responde 409, o diálogo mostra o estado novo e pede outra confirmação.
  const [vista, setVista] = useState(aberto)
  const atual = itens?.find((item) => item.id === aberto.id)
  const motivo = atual ? motivoEdicao(atual, analista.id) : null
  const mudou = atual !== undefined && atual.versao !== vista.versao
  const pendente = remover.isPending

  function confirmar() {
    if (!atual || motivo || pendente) return
    setErro(null)
    remover.mutate(vista, {
      onSuccess: () => {
        aoRemovido()
        aoConcluir({ texto: `Incidente #${atual.id} removido.`, id: atual.id })
      },
      onError: (falha) => {
        if (ehErroApi(falha) && falha.codigo === 'nao_encontrado') {
          aoRemovido()
          aoConcluir({ texto: `O incidente #${atual.id} já tinha sido removido.`, id: atual.id })
          return
        }
        if (ehErroApi(falha) && falha.ehConflito) {
          if (falha.atual) setVista(falha.atual)
          setErro('Não foi removido: o incidente mudou antes. Confira o estado atual e confirme de novo.')
          return
        }
        setErro(errosDaApi(falha).geral)
      },
    })
  }

  return (
    <>
      <AlertDialogHeader>
        <AlertDialogTitle>Remover o incidente #{aberto.id}?</AlertDialogTitle>
        <AlertDialogDescription>
          {(atual ?? vista).titulo}. A remoção é definitiva e tira o incidente da lista de
          todos os analistas.
        </AlertDialogDescription>
        <div role="status" className="text-[13px] font-medium">
          {!atual && itens !== undefined
            ? 'Outro analista já removeu este incidente.'
            : motivo
              ? `Não é possível remover: ${motivo}`
              : mudou && atual
                ? `Este incidente mudou desde que você abriu esta confirmação. Agora está ${descreverEstado(atual, analista.id)}. Remover agora vai pedir outra confirmação.`
                : null}
        </div>
      </AlertDialogHeader>


      {erro && (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-md border border-erro-borda bg-erro-fundo px-3 py-2 text-[13px] text-erro-texto"
        >
          <CircleAlert aria-hidden className="mt-px size-4 flex-none" />
          {erro}
        </p>
      )}

      <AlertDialogFooter>
        <AlertDialogCancel disabled={pendente}>Cancelar</AlertDialogCancel>
        {atual && !motivo ? (
          <Button
            type="button"
            variant="destructive"
            onClick={confirmar}
            aria-disabled={pendente || undefined}
            className="min-w-[160px]"
          >
            {pendente ? (
              <>
                <LogosLoader tamanho={16} decorativo fundo="var(--card)" />
                Removendo…
              </>
            ) : (
              'Remover incidente'
            )}
          </Button>
        ) : (
          <Button type="button" variant="outline" onClick={aoFechar}>
            Fechar
          </Button>
        )}
      </AlertDialogFooter>
    </>
  )
}
