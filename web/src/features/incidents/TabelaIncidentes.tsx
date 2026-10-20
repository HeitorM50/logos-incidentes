import { useState } from 'react'
import type { Incidente } from '@/api/tipos'
import { LogosLoader } from '@/components/LogosLoader'
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

/** Esqueleto da tabela + cartão com o loader da marca por cima (o esqueleto continua). */
export function TabelaCarregando() {
  return (
    <div aria-hidden className="relative min-w-[1280px]">
      <CabecalhoTabela />
      <div>
        {Array.from({ length: 12 }, (_, linha) => (
          <div
            key={linha}
            className={cn('grid h-11 items-center gap-x-3 border-b px-3', COLUNAS_TABELA)}
          >
            {LARGURAS_ESQUELETO[linha % 3].map((largura, coluna) => (
              <span
                key={coluna}
                className="h-2.5 rounded-sm bg-esqueleto motion-safe:animate-pulse"
                style={{ width: largura }}
              />
            ))}
          </div>
        ))}
      </div>
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
}: Props) {
  const [abertas, setAbertas] = useState<ReadonlySet<number>>(() => new Set())

  function alternar(id: number) {
    setAbertas((atuais) => {
      const novas = new Set(atuais)
      if (novas.has(id)) novas.delete(id)
      else novas.add(id)
      return novas
    })
  }

  return (
    // Tabela em ARIA sobre a grade: o leitor de tela anuncia o cabeçalho de cada coluna.
    <div role="table" aria-label="Incidentes" className="min-w-[1280px]">
      <CabecalhoTabela />
      {/* A ordem vem da API: não fechados, criticidade (alta → baixa), mais antigo primeiro. */}
      <div role="rowgroup">
        {itens.map((incidente) => (
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
          />
        ))}
      </div>
    </div>
  )
}
