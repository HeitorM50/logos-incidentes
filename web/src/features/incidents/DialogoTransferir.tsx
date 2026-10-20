import { useQuery } from '@tanstack/react-query'
import { useId, useState } from 'react'
import { listarAnalistas } from '@/api/incidentes'
import { REGRAS } from '@/api/regras'
import type { Incidente } from '@/api/tipos'
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
import { Textarea } from '@/components/ui/textarea'
import { LogosLoader } from '@/components/LogosLoader'
import type { Acao } from './acoes'

// Só o supervisor vê este diálogo: escolhe o novo responsável e, se quiser, diz por quê (troca
// de turno, sobrecarga). A transferência passa pelo mesmo fluxo das outras ações: otimista,
// 409 com o estado atual e "Desfazer".

interface Props {
  incidente: Incidente
  aberto: boolean
  aoMudar: (aberto: boolean) => void
  aoConfirmar: (acao: Acao) => void
}

export function DialogoTransferir({ incidente, aberto, aoMudar, aoConfirmar }: Props) {
  return (
    <AlertDialog open={aberto} onOpenChange={aoMudar}>
      {aberto && (
        <Conteudo incidente={incidente} aoCancelar={() => aoMudar(false)} aoConfirmar={aoConfirmar} />
      )}
    </AlertDialog>
  )
}

function Conteudo({
  incidente,
  aoCancelar,
  aoConfirmar,
}: {
  incidente: Incidente
  aoCancelar: () => void
  aoConfirmar: (acao: Acao) => void
}) {
  const id = useId()
  const consulta = useQuery({
    queryKey: ['analistas'],
    queryFn: ({ signal }) => listarAnalistas(signal),
    staleTime: 5 * 60_000,
  })
  const destinos = (consulta.data ?? []).filter((a) => a.id !== incidente.responsavel?.id)
  const [escolhido, setEscolhido] = useState('')
  const [comentario, setComentario] = useState('')
  const [tentou, setTentou] = useState(false)
  const para = destinos.find((a) => String(a.id) === escolhido)
  const limpo = comentario.trim()
  const erro = !para
    ? 'Escolha o novo responsável.'
    : limpo.length > REGRAS.comentario.max
      ? `Use no máximo ${REGRAS.comentario.max} caracteres.`
      : null

  function confirmar() {
    setTentou(true)
    if (erro || !para) return
    aoConfirmar({
      tipo: 'transferir',
      para: { id: para.id, nome: para.nome },
      comentario: limpo || undefined,
    })
  }

  return (
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>Transferir o incidente #{incidente.id}</AlertDialogTitle>
        <AlertDialogDescription>
          {incidente.titulo}.{' '}
          {incidente.responsavel
            ? `Hoje com ${incidente.responsavel.nome}.`
            : 'Hoje sem responsável.'}{' '}
          O novo responsável passa a tratar o incidente.
        </AlertDialogDescription>
      </AlertDialogHeader>
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${id}-destino`} className="text-[13px] font-medium">
            Novo responsável
          </label>
          {consulta.isPending ? (
            <p role="status" className="flex items-center gap-2 text-[13px] text-texto-2">
              <LogosLoader tamanho={16} decorativo fundo="var(--card)" />
              Carregando analistas…
            </p>
          ) : consulta.isError ? (
            <p role="alert" className="text-[13px] text-erro-texto">
              Não foi possível carregar os analistas. Feche e tente de novo.
            </p>
          ) : (
            <select
              id={`${id}-destino`}
              value={escolhido}
              onChange={(e) => setEscolhido(e.target.value)}
              aria-invalid={tentou && !para}
              className="h-9 rounded-md border border-input bg-transparent px-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <option value="">Escolha o analista</option>
              {destinos.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.nome}
                  {a.papel === 'supervisor' ? ' (supervisor)' : ''}
                </option>
              ))}
            </select>
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${id}-motivo`} className="text-[13px] font-medium">
            Motivo (opcional)
          </label>
          <Textarea
            id={`${id}-motivo`}
            rows={2}
            value={comentario}
            placeholder="Ex.: troca de turno; Ana saiu às 18h."
            onChange={(e) => setComentario(e.target.value)}
            className="resize-y text-[13px]"
          />
        </div>
        {tentou && erro && (
          <p role="alert" className="text-xs font-medium text-erro-texto">
            {erro}
          </p>
        )}
      </div>
      <AlertDialogFooter>
        <AlertDialogCancel onClick={aoCancelar}>Cancelar</AlertDialogCancel>
        <Button type="button" onClick={confirmar} disabled={!consulta.isSuccess}>
          Transferir
        </Button>
      </AlertDialogFooter>
    </AlertDialogContent>
  )
}
