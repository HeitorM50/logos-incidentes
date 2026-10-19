import { useState } from 'react'
import type { Incidente } from '@/api/tipos'
import { LogosLoader } from '@/components/LogosLoader'
import { cn } from '@/lib/utils'
import { COLUNAS_TABELA, LinhaIncidente } from './LinhaIncidente'

const CABECALHOS = [
  'Criticidade',
  'Título',
  'Categoria',
  'Local',
  'Tempo aberto',
  'Status',
  'Responsável',
]

// Larguras fixas por linha: o esqueleto parece uma tabela de verdade, sem pular de tamanho.
const LARGURAS_ESQUELETO = [
  ['60%', '78%', '70%', '82%', '64%', '72%', '58%'],
  ['56%', '64%', '84%', '66%', '70%', '60%', '74%'],
  ['64%', '88%', '62%', '74%', '58%', '80%', '52%'],
]

function CabecalhoTabela() {
  return (
    <div
      aria-hidden
      className={cn(
        'sticky top-0 z-[1] grid h-9 items-center gap-x-3 border-b bg-cabecalho px-3 text-xs font-semibold tracking-[0.04em] text-texto-2 uppercase',
        COLUNAS_TABELA,
      )}
    >
      {CABECALHOS.map((titulo, i) => (
        // O botão de detalhes ocupa o começo da coluna Título: o texto acompanha o recuo.
        <span key={titulo} className={cn(i === 1 && 'pl-[34px]')}>
          {titulo}
        </span>
      ))}
    </div>
  )
}

/** Esqueleto da tabela + cartão com o loader da marca por cima (o esqueleto continua). */
export function TabelaCarregando() {
  return (
    <div className="relative min-w-[1150px]">
      <CabecalhoTabela />
      <div aria-hidden>
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

interface Props {
  itens: Incidente[]
  idAnalista: number
  agora: number
}

export function TabelaIncidentes({ itens, idAnalista, agora }: Props) {
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
    <div className="min-w-[1150px]">
      <CabecalhoTabela />
      {/* A ordem vem da API: não fechados, criticidade (alta → baixa), mais antigo primeiro. */}
      <ol aria-label="Incidentes">
        {itens.map((incidente) => (
          <LinhaIncidente
            key={incidente.id}
            incidente={incidente}
            idAnalista={idAnalista}
            agora={agora}
            aberta={abertas.has(incidente.id)}
            aoAlternar={() => alternar(incidente.id)}
          />
        ))}
      </ol>
    </div>
  )
}
