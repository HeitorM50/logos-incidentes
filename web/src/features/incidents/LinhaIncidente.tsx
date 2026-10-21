import {
  AlarmClock,
  ChevronRight,
  Copy,
  ExternalLink,
  ListChecks,
  MessageCircle,
  Pencil,
  Phone,
  Trash2,
  Truck,
  UserRoundCog,
} from 'lucide-react'
import { useState } from 'react'
import { ROTULO_CATEGORIA, ROTULO_CRITICIDADE, ROTULO_STATUS } from '@/api/rotulos'
import type { Criticidade, Incidente } from '@/api/tipos'
import { formatarTelefone, linkLigar, linkWhatsApp } from '@/lib/telefone'
import { cn } from '@/lib/utils'
import type { Acao } from './acoes'
import { AcoesLinha, EM_ANDAMENTO, SEM_CONEXAO } from './AcoesLinha'
import { AvisoConflito } from './Avisos'
import { DialogoTransferir } from './DialogoTransferir'
import { HistoricoIncidente } from './HistoricoIncidente'
import { BotaoComMotivo } from './BotaoComMotivo'
import { motivoEdicao } from './formulario'
import { IconeCriticidade, IconeStatus } from './Icones'
import { estaAtrasado, explicarAtraso } from './prazos'
import { linkDoMapa, PROTOCOLOS } from './protocolos'
import { tempoCurtoDoIncidente, tempoDoIncidente } from './tempo'
import type { Conflito } from './useAcoesIncidente'

// Mínimos somam 1.280 px com espaços: a tabela cabe sem rolagem lateral num notebook de 1366
// px (com a margem da página e a barra de rolagem). Em telas maiores, título e local crescem.
// O título é a coluna que cresce e quebra em até 2 linhas; local e categoria também quebram;
// tempo, responsável e ações ficam estreitos. Mínimo de ~1.210 px: cabe numa tela de 1.280 px
// sem rolagem lateral.
export const COLUNAS_TABELA =
  'grid-cols-[84px_minmax(220px,3fr)_136px_minmax(150px,1.2fr)_72px_132px_112px_212px]'

const SELO: Record<Criticidade, string> = {
  alta: 'bg-alta-fundo text-alta-texto border-alta-borda font-bold',
  media: 'bg-media-fundo text-media-texto border-media-borda font-semibold',
  baixa: 'bg-baixa-fundo text-baixa-texto border-baixa-borda font-normal',
}

const FORMATO_DATA = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
})

interface Props {
  incidente: Incidente
  idAnalista: number
  agora: number
  aberta: boolean
  aoAlternar: () => void
  pendente?: Acao
  conflito?: Conflito
  semConexao: boolean
  aoExecutar: (acao: Acao) => void
  aoDispensarConflito: () => void
  aoEditar: () => void
  aoRemover: () => void
  /** Alta que acabou de chegar: destaque por alguns segundos (useAltaNova). */
  novo?: boolean
  /** "linha" na tabela (telas largas); "cartao" no celular e no tablet em pé. */
  layout?: 'linha' | 'cartao'
  /** Outros incidentes da mesma placa, para "Mesma placa" nos detalhes. */
  mesmaPlaca?: Incidente[]
  aoVerIncidente?: (id: number) => void
  /** Supervisor vê "Transferir" nos detalhes. */
  ehSupervisor?: boolean
}

export function LinhaIncidente({
  incidente,
  idAnalista,
  agora,
  aberta,
  aoAlternar,
  pendente,
  conflito,
  semConexao,
  aoExecutar,
  aoDispensarConflito,
  aoEditar,
  aoRemover,
  novo = false,
  layout = 'linha',
  mesmaPlaca = [],
  aoVerIncidente,
  ehSupervisor = false,
}: Props) {
  const fechado = incidente.status === 'fechado'
  const idDetalhes = `detalhes-incidente-${incidente.id}`
  const motivoAlterar = pendente
    ? EM_ANDAMENTO
    : semConexao
      ? SEM_CONEXAO
      : motivoEdicao(incidente, idAnalista)
  const cartao = layout === 'cartao'
  const atrasado = estaAtrasado(incidente, agora)

  const fundo = cn(
    conflito
      ? 'bg-info-fundo'
      : pendente
        ? 'bg-linha-pendente'
        : // Cartão (celular) em fundo próprio; na tabela, linhas em zebra suave.
          layout === 'cartao'
          ? 'bg-card'
          : 'even:bg-superficie-2/70',
    fechado && 'text-texto-3',
    // Alta novo: entra deslizando.
    novo && 'animate-in duration-500 fade-in-0 slide-in-from-left-2',
  )
  // Camadas de realce: o Alta novo some devagar (1,5 s) sem atrasar as outras cores, e o
  // brilho diz que a ação está no servidor.
  const camadas = (
    <>
      <span
        aria-hidden
        className={cn(
          'pointer-events-none absolute inset-0 rounded-[inherit] bg-alta-fundo/10 transition-opacity duration-[1500ms]',
          novo ? 'opacity-100' : 'opacity-0',
        )}
      />
      {pendente && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-[inherit] brilho-pendente"
        />
      )}
    </>
  )
  const acoes = (
    <AcoesLinha
      incidente={incidente}
      idAnalista={idAnalista}
      pendente={pendente}
      semConexao={semConexao}
      aoExecutar={aoExecutar}
    />
  )
  const botaoDetalhes = (
    <BotaoDetalhes
      incidente={incidente}
      aberta={aberta}
      aoAlternar={aoAlternar}
      idDetalhes={idDetalhes}
      comTexto={cartao}
    />
  )
  const avisoConflito = conflito && (
    <AvisoConflito
      conflito={conflito}
      incidente={incidente}
      idAnalista={idAnalista}
      aoManter={aoDispensarConflito}
      aoRefazer={() => aoExecutar(conflito.acao)}
    />
  )
  const detalhes = aberta && (
    <Detalhes
      incidente={incidente}
      idAnalista={idAnalista}
      agora={agora}
      idDetalhes={idDetalhes}
      motivoAlterar={motivoAlterar}
      aoEditar={aoEditar}
      aoRemover={aoRemover}
      mesmaPlaca={mesmaPlaca}
      aoVerIncidente={aoVerIncidente}
      transferir={
        ehSupervisor
          ? {
              motivo: pendente
                ? EM_ANDAMENTO
                : semConexao
                  ? SEM_CONEXAO
                  : fechado
                    ? 'Incidente fechado: não aceita mais alterações.'
                    : null,
              aoExecutar,
            }
          : undefined
      }
    />
  )

  if (cartao) {
    return (
      <li
        data-incidente={incidente.id}
        className={cn('relative scroll-mt-2 rounded-[18px] p-3.5 shadow-cartao', fundo)}
      >
        {camadas}
        {/* relative: o conteúdo fica por cima das camadas de realce e de brilho. */}
        <div className="relative flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <Selo incidente={incidente} />
            <span className="font-mono text-xs text-texto-3">#{incidente.id}</span>
            <Marcadores incidente={incidente} novo={novo} atrasado={atrasado} />
            <span className="ml-auto font-mono text-xs whitespace-nowrap text-texto-2">
              {fechado && 'aberto por '}
              {tempoDoIncidente(incidente, agora)}
            </span>
          </div>
          <p
            className={cn(
              'line-clamp-2 text-[15px] leading-snug',
              incidente.criticidade === 'alta' ? 'font-semibold' : 'font-medium',
            )}
          >
            {incidente.titulo}
          </p>
          <p className="text-[13px] leading-snug text-texto-2">
            {ROTULO_CATEGORIA[incidente.categoria]} · {incidente.local}
          </p>
          <div className="flex items-center gap-3">
            <span className="flex min-w-0 flex-1 items-center gap-2">
              <Status incidente={incidente} />
              <span aria-hidden className="text-texto-3">
                ·
              </span>
              <Responsavel incidente={incidente} idAnalista={idAnalista} />
            </span>
            {botaoDetalhes}
          </div>
          {acoes}
        </div>
        {avisoConflito && <div className="relative mt-2">{avisoConflito}</div>}
        {detalhes && <div className="relative">{detalhes}</div>}
      </li>
    )
  }

  return (
    <div
      role="none"
      data-incidente={incidente.id}
      // scroll-mt-9: ao rolar até a linha (setas ↑↓), ela não fica sob o cabeçalho fixo.
      className={cn('realce-linha relative scroll-mt-11 rounded-[14px] px-3 py-1.5', fundo)}
    >
      {camadas}
      {/* relative: o conteúdo fica por cima das camadas de realce e de brilho. */}
      <div role="row" className={cn('relative grid min-h-8 items-center gap-x-2.5', COLUNAS_TABELA)}>
        <span role="cell" className="justify-self-start">
          <Selo incidente={incidente} />
        </span>

        <span role="cell" className="flex min-w-0 items-start gap-1.5">
          {botaoDetalhes}
          {/* Número, marcadores e título no mesmo fluxo de texto, em até 2 linhas: o título
              aparece inteiro na maioria dos casos, e o title mostra o resto. */}
          <span
            title={incidente.titulo}
            className={cn(
              'line-clamp-2 min-w-0 pt-[5px] text-sm leading-snug',
              incidente.criticidade === 'alta' ? 'font-semibold' : 'font-medium',
            )}
          >
            <span className="mr-1.5 font-mono text-xs font-normal text-texto-3">
              #{incidente.id}
            </span>
            <Marcadores incidente={incidente} novo={novo} atrasado={atrasado} />
            {incidente.titulo}
          </span>
        </span>

        <span role="cell" className="text-[13px] leading-tight text-texto-2">
          {ROTULO_CATEGORIA[incidente.categoria]}
        </span>

        <span role="cell" title={incidente.local} className="line-clamp-2 text-[13px] leading-tight">
          {incidente.local}
        </span>

        <span
          role="cell"
          title={fechado ? 'Quanto ficou aberto até fechar' : undefined}
          className="font-mono text-[13px] whitespace-nowrap"
        >
          <span aria-hidden>{tempoCurtoDoIncidente(incidente, agora)}</span>
          <span className="sr-only">{tempoDoIncidente(incidente, agora)}</span>
        </span>

        <span role="cell">
          <Status incidente={incidente} />
        </span>

        <span role="cell" className="min-w-0">
          <Responsavel incidente={incidente} idAnalista={idAnalista} />
        </span>

        <span role="cell">{acoes}</span>
      </div>
      {avisoConflito && (
        <div role="row">
          <div role="cell" aria-colspan={8}>
            {avisoConflito}
          </div>
        </div>
      )}
      {detalhes && (
        <div role="row">
          <div role="cell" aria-colspan={8}>
            {detalhes}
          </div>
        </div>
      )}
    </div>
  )
}

function Selo({ incidente }: { incidente: Incidente }) {
  return (
    <span
      className={cn(
        'inline-flex h-[26px] items-center gap-1.5 rounded-full border pr-2.5 pl-2 text-xs tracking-[0.05em] whitespace-nowrap uppercase',
        // Sem opacidade no fechado: o selo perderia o contraste (a linha já fica em cinza).
        SELO[incidente.criticidade],
      )}
    >
      <IconeCriticidade criticidade={incidente.criticidade} />
      {ROTULO_CRITICIDADE[incidente.criticidade]}
    </span>
  )
}

/** Caminhão (chegou pelo rastreador), "Novo" (Alta recém-chegado) e "Atrasado" (prazo). */
interface PropsMarcadores {
  incidente: Incidente
  novo: boolean
  atrasado: boolean
}

function Marcadores({ incidente, novo, atrasado }: PropsMarcadores) {
  return (
    <>
      {/* Chegou sozinho, pelo rastreador: o analista distingue do que a central registrou. */}
      {incidente.dispositivo && (
        <span className="mr-1.5 inline-block align-[-2px]">
          <Truck aria-hidden className="size-3.5 text-texto-3" />
          <span className="sr-only">Enviado por {incidente.dispositivo.nome}</span>
        </span>
      )}
      {incidente.possivel_duplicata_de && (
        <span
          title={`Mesma placa, ou mesmo local e categoria, de #${incidente.possivel_duplicata_de} aberto pouco antes`}
          className="mr-1.5 inline-flex flex-none align-[1px] items-center gap-1 rounded-sm border border-info-borda bg-info-fundo px-1 py-px text-[10px] font-bold tracking-[0.06em] text-info-texto uppercase"
        >
          <Copy aria-hidden className="size-3" />
          {/* Curto na linha (o título precisa de espaço); completo para o leitor de tela. */}
          <span aria-hidden>Dup. #{incidente.possivel_duplicata_de}</span>
          <span className="sr-only">Possível duplicata de #{incidente.possivel_duplicata_de}</span>
        </span>
      )}
      {/* Texto, e não só a cor do fundo: o destaque precisa ser legível sem cor. */}
      {atrasado && (
        <span
          title={explicarAtraso(incidente)}
          className="mr-1.5 inline-flex flex-none align-[1px] items-center gap-1 rounded-sm border border-erro-borda bg-erro-fundo px-1 py-px text-[10px] font-bold tracking-[0.06em] text-erro-texto uppercase"
        >
          <AlarmClock aria-hidden className="size-3" />
          Atrasado
        </span>
      )}
      {novo && (
        <span className="mr-1.5 inline-block flex-none rounded-sm bg-alta-fundo px-1.5 py-px align-[1px] text-[10px] font-bold tracking-[0.06em] text-alta-texto uppercase">
          Novo
        </span>
      )}
    </>
  )
}

function Status({ incidente }: { incidente: Incidente }) {
  return (
    <span className="inline-flex h-[26px] items-center gap-1.5 rounded-full bg-pilula px-2.5 text-[13px] whitespace-nowrap text-texto-2">
      <IconeStatus status={incidente.status} />
      {ROTULO_STATUS[incidente.status]}
    </span>
  )
}

function Responsavel({ incidente, idAnalista }: { incidente: Incidente; idAnalista: number }) {
  const meu = incidente.responsavel?.id === idAnalista
  return (
    <span
      className={cn(
        // pr-0.5: o itálico de "Sem responsável" passa da caixa e o truncate cortaria a última letra.
        'block truncate pr-0.5 text-[13px]',
        !incidente.responsavel && 'text-texto-3 italic',
        meu && 'font-semibold',
      )}
    >
      {incidente.responsavel ? (meu ? 'Você' : incidente.responsavel.nome) : 'Sem responsável'}
    </span>
  )
}

const LINK_CONTATO =
  'inline-flex h-7 items-center gap-1 rounded-[5px] border border-borda-forte bg-card px-2 text-xs font-medium outline-none hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50'

/** Nome, telefone e os atalhos para ligar ou abrir o WhatsApp com o motorista. */
function ContatoMotorista({ incidente }: { incidente: Incidente }) {
  const { motorista_nome: nome, motorista_telefone: telefone } = incidente
  if (!nome && !telefone) return <span className="text-texto-3 italic">Não informado</span>
  const quem = nome ?? 'o motorista'
  return (
    <span className="flex flex-col items-start gap-1">
      {nome && <span>{nome}</span>}
      {telefone && (
        <>
          <span className="font-mono">{formatarTelefone(telefone)}</span>
          <span className="flex flex-wrap gap-1.5">
            <a href={linkLigar(telefone)} aria-label={`Ligar para ${quem}`} className={LINK_CONTATO}>
              <Phone aria-hidden className="size-3" />
              Ligar
            </a>
            <a
              href={linkWhatsApp(telefone)}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Abrir o WhatsApp de ${quem} (nova aba)`}
              className={LINK_CONTATO}
            >
              <MessageCircle aria-hidden className="size-3" />
              WhatsApp
            </a>
          </span>
        </>
      )}
    </span>
  )
}

interface PropsBotaoDetalhes {
  incidente: Incidente
  aberta: boolean
  aoAlternar: () => void
  idDetalhes: string
  /** No cartão, o botão diz "Detalhes" (alvo de toque maior); na linha, só a seta. */
  comTexto: boolean
}

function BotaoDetalhes({ incidente, aberta, aoAlternar, idDetalhes, comTexto }: PropsBotaoDetalhes) {
  return (
    <button
      type="button"
      data-alternar-detalhes
      onClick={aoAlternar}
      aria-expanded={aberta}
      aria-controls={aberta ? idDetalhes : undefined}
      aria-label={`${aberta ? 'Ocultar' : 'Ver'} detalhes de #${incidente.id}`}
      className={cn(
        'flex flex-none items-center justify-center gap-1 rounded-[5px] border text-texto-2',
        comTexto ? 'h-8 px-2.5 text-[13px] font-medium' : 'size-7',
        aberta
          ? 'border-borda-forte bg-superficie-2'
          : comTexto
            ? 'border-borda-forte hover:bg-accent'
            : 'border-transparent hover:bg-accent',
      )}
    >
      {comTexto && <span aria-hidden>Detalhes</span>}
      <ChevronRight
        aria-hidden
        // Gira com um pequeno exagero no fim (passa de 90° e assenta).
        className={cn(
          'size-4 transition-transform duration-200 ease-[cubic-bezier(0.34,1.56,0.64,1)]',
          aberta && 'rotate-90',
        )}
      />
    </button>
  )
}

interface PropsDetalhes {
  incidente: Incidente
  idAnalista: number
  agora: number
  idDetalhes: string
  motivoAlterar: string | null
  aoEditar: () => void
  aoRemover: () => void
  mesmaPlaca: Incidente[]
  aoVerIncidente?: (id: number) => void
  /** Presente só para o supervisor. */
  transferir?: { motivo: string | null; aoExecutar: (acao: Acao) => void }
}

function Detalhes({
  incidente,
  idAnalista,
  agora,
  idDetalhes,
  motivoAlterar,
  aoEditar,
  aoRemover,
  mesmaPlaca,
  aoVerIncidente,
  transferir,
}: PropsDetalhes) {
  const [transferindo, setTransferindo] = useState(false)
  return (
    <div
      id={idDetalhes}
      role="group"
      aria-label={`Detalhes de #${incidente.id}`}
      className="col-span-full mt-1.5 mb-2 grid animate-in gap-x-8 duration-200 fade-in-0 slide-in-from-top-1 gap-y-3 rounded-md border bg-superficie-2 px-4 py-3 text-[13px] sm:grid-cols-[2fr_1fr_1fr]"
    >
      <div className="flex flex-col gap-1">
        <p className="text-xs font-semibold tracking-[0.04em] text-texto-2 uppercase">
          Descrição
        </p>
        <p className="leading-normal whitespace-pre-line">
          {incidente.descricao || <span className="text-texto-3 italic">Sem descrição.</span>}
        </p>
        {/* Fechado não pede mais ação: o protocolo aparece só enquanto o incidente está ativo. */}
        {incidente.status !== 'fechado' && (
          <section aria-labelledby={`protocolo-${incidente.id}`} className="mt-2 flex flex-col gap-1">
            <p
              id={`protocolo-${incidente.id}`}
              className="flex items-center gap-1.5 text-xs font-semibold tracking-[0.04em] text-texto-2 uppercase"
            >
              <ListChecks aria-hidden className="size-3.5" />
              Protocolo sugerido · {ROTULO_CATEGORIA[incidente.categoria]}
            </p>
            <ol className="flex list-decimal flex-col gap-0.5 pl-5 leading-snug marker:text-texto-3">
              {PROTOCOLOS[incidente.categoria].map((passo) => (
                <li key={passo}>{passo}</li>
              ))}
            </ol>
          </section>
        )}
      </div>
      <dl className="grid grid-cols-[auto_1fr] content-start gap-x-3 gap-y-1">
        <dt className="text-texto-3">Placa</dt>
        <dd className="font-mono">{incidente.placa ?? '—'}</dd>
        <dt className="text-texto-3">Motorista</dt>
        <dd>
          <ContatoMotorista incidente={incidente} />
        </dd>
        <dt className="text-texto-3">Local</dt>
        <dd className="flex flex-col items-start gap-0.5">
          {incidente.local}
          <a
            href={linkDoMapa(incidente.local, incidente.latitude, incidente.longitude)}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Abrir no mapa: ${incidente.local} (nova aba)`}
            className="inline-flex items-center gap-1 rounded-sm font-medium text-foreground underline underline-offset-3 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            Abrir no mapa
            <ExternalLink aria-hidden className="size-3" />
          </a>
        </dd>
        <dt className="text-texto-3">Origem</dt>
        <dd>{incidente.dispositivo ? incidente.dispositivo.nome : 'Registrado na central'}</dd>
        {incidente.possivel_duplicata_de && (
          <>
            <dt className="text-texto-3">Duplicata?</dt>
            <dd className="flex flex-col items-start gap-0.5">
              <span>
                Parece o mesmo problema de #{incidente.possivel_duplicata_de}, aberto pouco antes.
              </span>
              <button
                type="button"
                onClick={() => aoVerIncidente?.(incidente.possivel_duplicata_de!)}
                className="cursor-pointer rounded-sm font-medium underline underline-offset-3 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                Ver #{incidente.possivel_duplicata_de} na lista
              </button>
            </dd>
          </>
        )}
        {mesmaPlaca.length > 0 && (
          <>
            <dt className="text-texto-3">Mesma placa</dt>
            <dd>
              <ul aria-label={`Outros incidentes da placa ${incidente.placa}`} className="flex flex-col gap-0.5">
                {mesmaPlaca.map((outro) => (
                  <li key={outro.id}>
                    <button
                      type="button"
                      onClick={() => aoVerIncidente?.(outro.id)}
                      className="cursor-pointer rounded-sm text-left underline-offset-3 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
                    >
                      <span className="font-mono text-texto-3">#{outro.id}</span>{' '}
                      {ROTULO_CATEGORIA[outro.categoria]}
                      <span className="text-texto-3"> · {ROTULO_STATUS[outro.status]}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </dd>
          </>
        )}
      </dl>
      <dl className="grid grid-cols-[auto_1fr] content-start gap-x-3 gap-y-1">
        <dt className="text-texto-3">Aberto em</dt>
        <dd className="font-mono">{FORMATO_DATA.format(new Date(incidente.criado_em))}</dd>
        <dt className="text-texto-3">Alterado em</dt>
        <dd className="font-mono">{FORMATO_DATA.format(new Date(incidente.atualizado_em))}</dd>
        <dt className="text-texto-3">Por</dt>
        <dd>{incidente.atualizado_por?.nome ?? '—'}</dd>
      </dl>
      <div className="border-t pt-3 sm:col-span-3">
        <HistoricoIncidente incidente={incidente} idAnalista={idAnalista} agora={agora} />
      </div>
      <div className="flex flex-wrap justify-end gap-2 border-t pt-3 sm:col-span-3">
        {transferir && (
          <>
            <BotaoComMotivo
              motivo={transferir.motivo}
              rotulo={`Transferir #${incidente.id}`}
              onClick={() => setTransferindo(true)}
              className="mr-auto flex items-center gap-1.5 px-3 font-medium"
            >
              <UserRoundCog aria-hidden className="size-3.5" />
              Transferir
            </BotaoComMotivo>
            <DialogoTransferir
              incidente={incidente}
              aberto={transferindo}
              aoMudar={setTransferindo}
              aoConfirmar={(acao) => {
                setTransferindo(false)
                transferir.aoExecutar(acao)
              }}
            />
          </>
        )}
        <BotaoComMotivo
          motivo={motivoAlterar}
          rotulo={`Editar #${incidente.id}`}
          onClick={aoEditar}
          className="flex items-center gap-1.5 px-3 font-medium"
        >
          <Pencil aria-hidden className="size-3.5" />
          Editar
        </BotaoComMotivo>
        <BotaoComMotivo
          motivo={motivoAlterar}
          rotulo={`Remover #${incidente.id}`}
          onClick={aoRemover}
          className="flex items-center gap-1.5 px-3 font-medium text-erro-texto"
        >
          <Trash2 aria-hidden className="size-3.5" />
          Remover
        </BotaoComMotivo>
      </div>
    </div>
  )
}
