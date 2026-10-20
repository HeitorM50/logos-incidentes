import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import type { Incidente } from '@/api/tipos'
import { LogosLoader } from '@/components/LogosLoader'
import { useEhCelular } from '@/lib/useEhCelular'
import { useFlipLinhas } from '@/lib/useFlipLinhas'
import { cn } from '@/lib/utils'
import { COLUNAS_TABELA, LinhaIncidente } from './LinhaIncidente'
import type { AcoesIncidente, Conflito } from './useAcoesIncidente'

const CABECALHOS = [
  'Criticidade',
  'Título',
  'Categoria',
  'Local',
  'Tempo aberto',
  'Status',
  'Responsável',
  'Ações',
]

// Larguras fixas por linha: o esqueleto parece uma tabela de verdade, sem pular de tamanho.
const LARGURAS_ESQUELETO = [
  ['60%', '78%', '70%', '82%', '64%', '72%', '58%', '180px'],
  ['56%', '64%', '84%', '66%', '70%', '60%', '74%', '180px'],
  ['64%', '88%', '62%', '74%', '58%', '80%', '52%', '180px'],
]

/** Cabeçalho fixo no topo ao rolar. O grupo (e não a linha) é sticky: o pai dele é a tabela. */
function CabecalhoTabela() {
  return (
    <div role="rowgroup" className="sticky top-0 z-[1] border-b bg-cabecalho">
      <div
        role="row"
        className={cn(
          'grid h-9 items-center gap-x-3 px-3 text-xs font-semibold tracking-[0.04em] text-texto-2 uppercase',
          COLUNAS_TABELA,
        )}
      >
        {CABECALHOS.map((titulo, i) => (
          // O botão de detalhes ocupa o começo da coluna Título: o texto acompanha o recuo.
          <span key={titulo} role="columnheader" className={cn(i === 1 && 'pl-[34px]')}>
            {titulo}
          </span>
        ))}
      </div>
    </div>
  )
}

function Barra({ largura, className }: { largura: string; className?: string }) {
  return (
    <span
      className={cn('block h-2.5 rounded-sm bg-esqueleto brilho-esqueleto', className)}
      style={{ width: largura }}
    />
  )
}

/** Esqueleto da tabela (ou dos cartões) + loader da marca por cima (o esqueleto continua). */
export function TabelaCarregando() {
  const celular = useEhCelular()
  return (
    <div aria-hidden className={cn('relative', !celular && 'min-w-[1280px]')}>
      {celular ? (
        <div className="flex flex-col gap-2 p-2">
          {Array.from({ length: 5 }, (_, cartao) => {
            const larguras = LARGURAS_ESQUELETO[cartao % 3]
            return (
              <div key={cartao} className="flex flex-col gap-3 rounded-lg border bg-card p-3">
                <div className="flex items-center gap-2">
                  <Barra largura="72px" className="h-5" />
                  <Barra largura="32px" />
                  <Barra largura="48px" className="ml-auto" />
                </div>
                <Barra largura={larguras[1]} className="h-3" />
                <Barra largura={larguras[3]} />
                <div className="flex justify-between">
                  <Barra largura="96px" />
                  <Barra largura="72px" />
                </div>
                <Barra largura="100%" className="h-8" />
              </div>
            )
          })}
        </div>
      ) : (
        <>
          <CabecalhoTabela />
          <div>
            {Array.from({ length: 12 }, (_, linha) => (
              <div
                key={linha}
                className={cn('grid h-11 items-center gap-x-3 border-b px-3', COLUNAS_TABELA)}
              >
                {LARGURAS_ESQUELETO[linha % 3].map((largura, coluna) => (
                  <Barra key={coluna} largura={largura} />
                ))}
              </div>
            ))}
          </div>
        </>
      )}
      <div className="absolute inset-x-0 top-24 flex justify-center">
        <div className="rounded-lg border bg-card px-8 py-5 shadow-[0_8px_30px_-12px_rgb(0_0_0/0.25)]">
          {/* Decorativo: quem anuncia o carregamento é a linha de estado acima da tabela. */}
          <LogosLoader
            tamanho={48}
            decorativo
            fundo="var(--card)"
            legenda="Carregando incidentes…"
          />
        </div>
      </div>
    </div>
  )
}

/** O aviso de conflito vale só enquanto a linha mostra a versão que veio no 409. */
function conflitoAtual(conflito: Conflito | undefined, incidente: Incidente) {
  return conflito?.versao === incidente.versao ? conflito : undefined
}

interface Props {
  itens: Incidente[]
  idAnalista: number
  agora: number
  acoes: AcoesIncidente
  semConexao: boolean
  aoEditar: (incidente: Incidente) => void
  aoRemover: (incidente: Incidente) => void
  /** Ids dos Alta recém-chegados, em destaque. */
  destaques: ReadonlySet<number>
  /** Todos os incidentes de cada placa (ativos e fechados). */
  porPlaca: ReadonlyMap<string, Incidente[]>
  /** Leva a lista até um incidente (busca por #número). */
  aoVerIncidente: (id: number) => void
  ehSupervisor: boolean
}

export function TabelaIncidentes({
  itens,
  idAnalista,
  agora,
  acoes,
  semConexao,
  aoEditar,
  aoRemover,
  destaques,
  porPlaca,
  aoVerIncidente,
  ehSupervisor,
}: Props) {
  const [abertas, setAbertas] = useState<ReadonlySet<number>>(() => new Set())
  // As primeiras linhas entram em cascata só quando a tabela aparece; linhas que chegam depois
  // (filtro, leitura de 5 s) entram sem coreografia.
  const grupo = useRef<HTMLDivElement & HTMLOListElement>(null)
  const celular = useEhCelular()
  useFlipLinhas(grupo, ':scope > [data-incidente]')
  const [primeiraPintura, setPrimeiraPintura] = useState(true)
  useEffect(() => {
    const id = setTimeout(() => setPrimeiraPintura(false), 900)
    return () => clearTimeout(id)
  }, [])

  function alternar(id: number) {
    setAbertas((atuais) => {
      const novas = new Set(atuais)
      if (novas.has(id)) novas.delete(id)
      else novas.add(id)
      return novas
    })
  }

  /**
   * ↑ e ↓ com o foco na seta de detalhes de uma linha: passa para a linha de cima ou de baixo.
   * Só ali, para não roubar as setas de menus e campos. Em 100 linhas, é bem mais rápido que Tab.
   */
  function andarComSetas(evento: KeyboardEvent<HTMLElement>) {
    if (evento.key !== 'ArrowDown' && evento.key !== 'ArrowUp') return
    if (evento.altKey || evento.ctrlKey || evento.metaKey || evento.shiftKey) return
    const alvo = evento.target as HTMLElement
    if (!alvo.matches('[data-alternar-detalhes]')) return
    const botoes = [
      ...(grupo.current?.querySelectorAll<HTMLElement>('[data-alternar-detalhes]') ?? []),
    ]
    const proximo = botoes[botoes.indexOf(alvo) + (evento.key === 'ArrowDown' ? 1 : -1)]
    if (!proximo) return
    evento.preventDefault()
    proximo.focus()
    proximo.scrollIntoView?.({ block: 'nearest' })
  }

  const linhas = itens.map((incidente) => (
    <LinhaIncidente
      key={incidente.id}
      incidente={incidente}
      idAnalista={idAnalista}
      agora={agora}
      aberta={abertas.has(incidente.id)}
      aoAlternar={() => alternar(incidente.id)}
      pendente={acoes.pendentes.get(incidente.id)}
      conflito={conflitoAtual(acoes.conflitos[incidente.id], incidente)}
      semConexao={semConexao}
      aoExecutar={(acao) => acoes.executar(incidente, acao)}
      aoDispensarConflito={() => acoes.dispensarConflito(incidente.id)}
      aoEditar={() => aoEditar(incidente)}
      aoRemover={() => aoRemover(incidente)}
      novo={destaques.has(incidente.id)}
      layout={celular ? 'cartao' : 'linha'}
      mesmaPlaca={
        incidente.placa
          ? (porPlaca.get(incidente.placa) ?? []).filter((i) => i.id !== incidente.id)
          : []
      }
      aoVerIncidente={aoVerIncidente}
      ehSupervisor={ehSupervisor}
    />
  ))
  const cascata = cn(primeiraPintura && 'cascata [--cascata-passo:20ms]')

  if (celular) {
    // Lista de cartões: mesma ordem, mesmas ações, mesmo realce. Sem cabeçalho de colunas.
    return (
      <ol
        ref={grupo}
        aria-label="Incidentes"
        className={cn('flex flex-col gap-2 p-2', cascata)}
        onKeyDown={andarComSetas}
      >
        {linhas}
      </ol>
    )
  }

  return (
    // Tabela em ARIA sobre a grade: o leitor de tela anuncia o cabeçalho de cada coluna.
    <div role="table" aria-label="Incidentes" className="min-w-[1280px]">
      <CabecalhoTabela />
      {/* A ordem vem da API: não fechados, criticidade (alta → baixa), mais antigo primeiro. */}
      <div ref={grupo} role="rowgroup" className={cascata} onKeyDown={andarComSetas}>
        {linhas}
      </div>
    </div>
  )
}
