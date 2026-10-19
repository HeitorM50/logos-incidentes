import { CircleCheck, Undo2, UserRoundCog, X } from 'lucide-react'
import type { ReactNode } from 'react'
import type { Incidente } from '@/api/tipos'
import { descreverEstado, motivoBloqueio, nomeDaAcao } from './acoes'
import type { AvisoFalha, Conflito } from './useAcoesIncidente'

const BOTAO_INFO =
  'h-8 cursor-pointer rounded-[5px] border px-3 text-[13px] outline-none focus-visible:ring-3 focus-visible:ring-ring/50'

interface PropsConflito {
  conflito: Conflito
  /** O incidente como está na lista agora (pode ter mudado de novo depois do 409). */
  incidente: Incidente
  idAnalista: number
  aoManter: () => void
  aoRefazer: () => void
}

/**
 * Aviso dentro da linha quando a API responde 409: outro analista alterou antes. Não é região
 * viva: o anúncio sai da região única das ações (vários conflitos não se atropelam).
 */
export function AvisoConflito({
  conflito,
  incidente,
  idAnalista,
  aoManter,
  aoRefazer,
}: PropsConflito) {
  const quem = conflito.autor ?? 'Outro analista'
  // "Refazer" usa a versão atual; se a regra não deixa mais (ex.: Bruno assumiu), o motivo
  // aparece no lugar do botão.
  const motivo = motivoBloqueio(incidente, conflito.acao, idAnalista)

  return (
    <div
      className="col-span-full mt-1 mb-0.5 flex flex-wrap items-center gap-x-4 gap-y-2.5 rounded-md border border-info-borda bg-info-fundo px-3 py-2.5 text-[13px] leading-[1.45] text-info-texto"
    >
      <UserRoundCog aria-hidden className="size-[18px] flex-none" />
      <div className="flex min-w-0 flex-[1_1_420px] flex-col gap-0.5">
        <strong className="text-sm font-semibold">
          {quem === 'Você'
            ? 'Você alterou este incidente em outra janela'
            : `${quem} alterou este incidente`}
        </strong>
        <span>
          Agora está {descreverEstado(incidente, idAnalista)}. Sua ação “
          {nomeDaAcao(conflito.acao)}” não foi aplicada; a linha já mostra a versão atual.
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={aoManter}
          className={`${BOTAO_INFO} border-info-botao bg-info-botao font-semibold text-info-sobre-botao`}
        >
          Manter versão atual
        </button>
        {motivo ? (
          <span className="text-xs">Não dá para refazer: {motivo}</span>
        ) : (
          <button
            type="button"
            onClick={aoRefazer}
            className={`${BOTAO_INFO} border-info-borda bg-transparent font-medium`}
          >
            Refazer minha ação
          </button>
        )}
      </div>
    </div>
  )
}

interface PropsSucesso {
  texto: string
  /** Botão opcional (ex.: mostrar o incidente criado na lista). */
  acao?: { rotulo: string; aoClicar: () => void }
  aoFechar: () => void
}

/**
 * Confirmação visível de criar, editar ou remover. Não é região viva: o anúncio sai de uma
 * região fixa da tela (uma região criada já com texto nem sempre é lida).
 */
export function AvisoSucesso({ texto, acao, aoFechar }: PropsSucesso) {
  return (
    <div
      onKeyDown={(evento) => {
        if (evento.key === 'Escape') aoFechar()
      }}
      className="flex items-center gap-3 rounded-lg border border-borda-forte bg-card py-2.5 pr-2 pl-4 text-sm shadow-[0_10px_30px_rgba(0,0,0,0.18)]"
    >
      <CircleCheck aria-hidden className="size-[18px] flex-none text-ao-vivo" />
      <span className="min-w-0 flex-1 font-medium">{texto}</span>
      {acao && (
        <button
          type="button"
          onClick={acao.aoClicar}
          className="h-8 cursor-pointer rounded-[5px] border border-borda-forte px-3 text-[13px] font-semibold outline-none hover:bg-superficie-2 focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          {acao.rotulo}
        </button>
      )}
      <button
        type="button"
        aria-label="Fechar confirmação"
        onClick={aoFechar}
        className="flex size-8 flex-none cursor-pointer items-center justify-center rounded-[5px] outline-none hover:bg-superficie-2 focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <X aria-hidden className="size-3.5" />
      </button>
    </div>
  )
}

interface PropsFalha {
  avisos: AvisoFalha[]
  /** Confirmação de sucesso, empilhada abaixo das falhas. */
  sucesso?: ReactNode
  aoTentar: (aviso: AvisoFalha) => void
  aoFechar: (id: number) => void
}

/** Avisos flutuantes das ações que falharam (a linha já voltou ao estado anterior). */
export function PilhaAvisos({ avisos, sucesso, aoTentar, aoFechar }: PropsFalha) {
  if (avisos.length === 0 && !sucesso) return null
  return (
    <div className="fixed right-6 bottom-6 z-20 flex w-[min(480px,calc(100%-48px))] flex-col gap-2">
      {avisos.map((aviso) => (
        <div
          key={aviso.id}
          role="alert"
          onKeyDown={(evento) => {
            if (evento.key === 'Escape') aoFechar(aviso.id)
          }}
          className="flex items-start gap-3 rounded-lg bg-aviso-fundo py-3.5 pr-3 pl-4 text-aviso-texto shadow-[0_10px_30px_rgba(0,0,0,0.28)]"
        >
          <Undo2 aria-hidden className="mt-px size-5 flex-none text-aviso-icone" />
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <strong className="text-sm font-semibold">{aviso.titulo}</strong>
            <span className="text-[13px] leading-[1.45] text-aviso-detalhe">{aviso.detalhe}</span>
            {aviso.podeRepetir && (
              <div className="mt-1.5 flex gap-2">
                <button
                  type="button"
                  onClick={() => aoTentar(aviso)}
                  className="h-8 cursor-pointer rounded-[5px] border border-aviso-borda-botao px-3 text-[13px] font-semibold outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  Tentar de novo
                </button>
              </div>
            )}
          </div>
          <button
            type="button"
            aria-label={`Fechar aviso de #${aviso.id}`}
            onClick={() => aoFechar(aviso.id)}
            className="flex size-8 flex-none cursor-pointer items-center justify-center rounded-[5px] outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <X aria-hidden className="size-3.5" />
          </button>
        </div>
      ))}
      {sucesso}
    </div>
  )
}
