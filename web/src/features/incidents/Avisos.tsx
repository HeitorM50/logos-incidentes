import { CircleCheck, RotateCcw, Undo2, UserRoundCog, X } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { IconeCriticidade } from './Icones'
import type { AvisoAltaNova as DadosAltaNova } from './useAltaNova'
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

export const DURACAO_DESFAZER_MS = 6_000
const PASSO_CONTAGEM_MS = 100

interface PropsDesfazer {
  texto: string
  aoDesfazer: () => void
  /** X ou Esc (o foco está no aviso e precisa de outro lugar). */
  aoFechar: () => void
  /** Tempo esgotado (só corre com o foco fora do aviso). Precisa ser estável. */
  aoExpirar: () => void
}

/**
 * "Você assumiu #12 · Desfazer" (desenho do protótipo). A contagem para enquanto o mouse ou o
 * foco estão no aviso: quem está lendo ou chegando pelo Tab não perde o botão (WCAG 2.2.1).
 */
export function AvisoDesfazer({ texto, aoDesfazer, aoFechar, aoExpirar }: PropsDesfazer) {
  const caixa = useRef<HTMLDivElement>(null)
  const [restante, setRestante] = useState(DURACAO_DESFAZER_MS)
  const [mouse, setMouse] = useState(false)
  const [foco, setFoco] = useState(false)
  const parado = mouse || foco

  // Aviso novo que surge debaixo do cursor (troca por outro incidente) já nasce parado: o
  // mouse não se mexeu, então não há mouseenter.
  useEffect(() => {
    if (caixa.current?.matches(':hover')) setMouse(true)
  }, [])

  // Relógio real (e não contagem de ticks): aba em segundo plano não estica os 6 s.
  const restanteRef = useRef(DURACAO_DESFAZER_MS)
  useEffect(() => {
    if (parado) return
    const fim = performance.now() + restanteRef.current
    const id = setInterval(() => {
      const falta = Math.max(0, fim - performance.now())
      restanteRef.current = falta
      setRestante(falta)
      if (falta === 0) {
        clearInterval(id)
        aoExpirar()
      }
    }, PASSO_CONTAGEM_MS)
    return () => clearInterval(id)
  }, [parado, aoExpirar])

  return (
    <div
      ref={caixa}
      // Só o mouse pausa: no toque, "entrar" sem "sair" pararia a contagem para sempre.
      onPointerEnter={(e) => e.pointerType === 'mouse' && setMouse(true)}
      onPointerLeave={(e) => e.pointerType === 'mouse' && setMouse(false)}
      onFocus={() => setFoco(true)}
      onBlur={() => setFoco(false)}
      onKeyDown={(evento) => {
        if (evento.key === 'Escape') aoFechar()
      }}
      className="overflow-hidden rounded-lg bg-aviso-fundo text-aviso-texto shadow-[0_10px_30px_rgba(0,0,0,0.28)]"
    >
      <div className="flex items-center gap-3 py-2.5 pr-2 pl-4">
        {/* Cor do texto, e não o verde de sucesso: o fundo do aviso inverte com o tema. */}
        <CircleCheck aria-hidden className="size-[18px] flex-none" />
        <span className="min-w-0 flex-1 text-sm font-medium">{texto}</span>
        <button
          type="button"
          onClick={aoDesfazer}
          aria-keyshortcuts="Control+Z Meta+Z"
          className="flex h-8 flex-none cursor-pointer items-center gap-1.5 rounded-[5px] border border-aviso-borda-botao px-3 text-[13px] font-semibold outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <RotateCcw aria-hidden className="size-3.5" />
          Desfazer
          <kbd aria-hidden className="ml-0.5 font-mono text-[11px] font-normal text-aviso-detalhe">
            Ctrl+Z
          </kbd>
        </button>
        <button
          type="button"
          aria-label="Fechar aviso de desfazer"
          onClick={aoFechar}
          className="flex size-8 flex-none cursor-pointer items-center justify-center rounded-[5px] outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <X aria-hidden className="size-3.5" />
        </button>
      </div>
      {/* Tempo que falta para o "Desfazer" sumir (decorativo: o texto não depende dele). */}
      <div aria-hidden className="h-0.5 bg-aviso-borda-botao/30">
        <div
          className="h-full bg-aviso-texto/70"
          style={{ width: `${(restante / DURACAO_DESFAZER_MS) * 100}%` }}
        />
      </div>
    </div>
  )
}

interface PropsAltaNova {
  aviso: DadosAltaNova
  aoVer: (id: number) => void
  aoFechar: () => void
}

/**
 * Incidente Alta que chegou pela leitura de 5 s. Ele entra no fim do grupo Alta, talvez fora
 * da tela: "Ver" leva até a linha. O anúncio sai de uma região fixa (ver TelaTriagem).
 */
export function AvisoAltaNova({ aviso, aoVer, aoFechar }: PropsAltaNova) {
  const quantos = aviso.ids.length
  return (
    <div
      onKeyDown={(evento) => {
        if (evento.key === 'Escape') aoFechar()
      }}
      className="flex items-center gap-3 rounded-lg border-2 border-alta-borda bg-card py-2.5 pr-2 pl-3.5 text-sm shadow-[0_10px_30px_rgba(0,0,0,0.18)]"
    >
      <span className="flex size-7 flex-none items-center justify-center rounded-md bg-alta-fundo text-alta-texto">
        <IconeCriticidade criticidade="alta" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col leading-tight">
        <strong className="font-semibold">
          {quantos === 1 ? 'Novo incidente Alta' : `${quantos} novos incidentes Alta`}
        </strong>
        <span className="truncate text-[13px] text-texto-2">
          {quantos === 1
            ? `#${aviso.ids[0]} · ${aviso.titulo}`
            : aviso.ids.map((id) => `#${id}`).join(', ')}
        </span>
      </span>
      <button
        type="button"
        onClick={() => aoVer(aviso.ids[0])}
        className="h-8 flex-none cursor-pointer rounded-[5px] border border-borda-forte px-3 text-[13px] font-semibold outline-none hover:bg-superficie-2 focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        {quantos === 1 ? 'Ver' : `Ver #${aviso.ids[0]}`}
      </button>
      <button
        type="button"
        aria-label="Fechar aviso de incidente Alta novo"
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
  /** Outros avisos (Alta novo, sucesso), empilhados abaixo das falhas. */
  outros?: ReactNode
  aoTentar: (aviso: AvisoFalha) => void
  aoFechar: (id: number) => void
}

/** Avisos flutuantes das ações que falharam (a linha já voltou ao estado anterior). */
export function PilhaAvisos({ avisos, outros, aoTentar, aoFechar }: PropsFalha) {
  if (avisos.length === 0 && !outros) return null
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
      {outros}
    </div>
  )
}
