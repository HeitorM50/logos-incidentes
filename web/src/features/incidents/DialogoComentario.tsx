import { useId, useState, type KeyboardEvent } from 'react'
import { exigeComentario, REGRAS } from '@/api/regras'
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
import type { Acao } from './acoes'

// Fechar, marcar inconclusivo e liberar passam por aqui. O comentário é o registro de COMO o
// incidente foi resolvido (ou por que parou): sem ele, o histórico diz que fechou, mas não diz
// por quê. A regra (obrigatório, limites) vem da API, por regras.json.

/** Ações que pedem o diálogo de comentário. */
export type AcaoComComentario =
  | { tipo: 'liberar' }
  | { tipo: 'status'; status: 'fechado' | 'inconclusivo' }

function textos(acao: AcaoComComentario, incidente: Incidente) {
  if (acao.tipo === 'liberar') {
    return {
      titulo: `Liberar o incidente #${incidente.id}?`,
      descricao: `${incidente.titulo}. O incidente volta para a fila, para outro analista assumir.`,
      rotulo: 'Comentário para o próximo analista (opcional)',
      exemplo: 'Ex.: motorista não atende; tentar de novo às 15h.',
      confirmar: 'Liberar',
    }
  }
  if (acao.status === 'fechado') {
    return {
      titulo: `Fechar o incidente #${incidente.id}?`,
      descricao: `${incidente.titulo}. Fechado é o estado final: o incidente não aceita mais alterações e não volta a ser aberto.`,
      rotulo: 'Como o incidente foi resolvido? (obrigatório)',
      exemplo: 'Ex.: guincho removeu o veículo às 14h; pista liberada.',
      confirmar: 'Fechar incidente',
    }
  }
  return {
    titulo: `Marcar o incidente #${incidente.id} como Inconclusivo?`,
    descricao: `${incidente.titulo}. Diga por que a investigação parou: o próximo analista parte daqui.`,
    rotulo: 'Por que ficou inconclusivo? (obrigatório)',
    exemplo: 'Ex.: sem contato com o motorista e sem imagem da rodovia.',
    confirmar: 'Marcar Inconclusivo',
  }
}

interface Props {
  incidente: Incidente
  /** A ação pedida; null mantém o diálogo fechado. */
  acao: AcaoComComentario | null
  aoCancelar: () => void
  aoConfirmar: (acao: Acao) => void
  /** Para onde vai o foco ao fechar (o gatilho pode ter saído da tela). */
  aoFecharFoco: () => void
}

export function DialogoComentario(props: Props) {
  return (
    <AlertDialog open={props.acao !== null} onOpenChange={(aberto) => !aberto && props.aoCancelar()}>
      {/* key: cada abertura começa com o campo vazio. */}
      {props.acao && <Conteudo key={`${props.acao.tipo}-${props.incidente.id}`} {...props} acao={props.acao} />}
    </AlertDialog>
  )
}

function Conteudo({
  incidente,
  acao,
  aoCancelar,
  aoConfirmar,
  aoFecharFoco,
}: Props & { acao: AcaoComComentario }) {
  const [texto, setTexto] = useState('')
  const [tentou, setTentou] = useState(false)
  const id = useId()
  const t = textos(acao, incidente)
  const obrigatorio = acao.tipo === 'status' && exigeComentario(acao.status)
  const limpo = texto.trim()
  const { min, max } = REGRAS.comentario
  const erro =
    limpo.length > max
      ? `Use no máximo ${max} caracteres.`
      : obrigatorio && limpo.length < min
        ? `Escreva pelo menos ${min} caracteres.`
        : null

  function confirmar() {
    setTentou(true)
    if (erro) return
    const comentario = limpo || undefined
    aoConfirmar(acao.tipo === 'liberar' ? { tipo: 'liberar', comentario } : { ...acao, comentario })
  }

  function aoTeclar(evento: KeyboardEvent<HTMLTextAreaElement>) {
    // Ctrl+Enter (ou ⌘+Enter) confirma sem sair do campo; Enter sozinho quebra a linha.
    if (evento.key === 'Enter' && (evento.ctrlKey || evento.metaKey)) {
      evento.preventDefault()
      confirmar()
    }
  }

  return (
    <AlertDialogContent
      onCloseAutoFocus={(evento) => {
        evento.preventDefault()
        aoFecharFoco()
      }}
    >
      <AlertDialogHeader>
        <AlertDialogTitle>{t.titulo}</AlertDialogTitle>
        <AlertDialogDescription>{t.descricao}</AlertDialogDescription>
      </AlertDialogHeader>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${id}-campo`} className="text-[13px] font-medium">
          {t.rotulo}
        </label>
        <Textarea
          id={`${id}-campo`}
          autoFocus
          rows={3}
          value={texto}
          placeholder={t.exemplo}
          onChange={(evento) => setTexto(evento.target.value)}
          onKeyDown={aoTeclar}
          aria-invalid={tentou && !!erro}
          aria-describedby={`${id}-ajuda`}
          className="resize-y text-[13px]"
        />
        <p id={`${id}-ajuda`} className="flex justify-between gap-3 text-xs text-texto-3">
          <span role={tentou && erro ? 'alert' : undefined} className={tentou && erro ? 'text-erro-texto' : undefined}>
            {tentou && erro ? erro : 'Ctrl+Enter confirma.'}
          </span>
          <span className="font-mono tabular-nums">
            {limpo.length}/{max}
          </span>
        </p>
      </div>
      <AlertDialogFooter>
        <AlertDialogCancel onClick={aoCancelar}>Cancelar</AlertDialogCancel>
        <Button type="button" onClick={confirmar}>
          {t.confirmar}
        </Button>
      </AlertDialogFooter>
    </AlertDialogContent>
  )
}
