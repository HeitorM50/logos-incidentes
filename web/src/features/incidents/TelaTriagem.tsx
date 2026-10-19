import { useMemo, useState } from 'react'
import { ehErroApi } from '@/api/erros'
import type { AnalistaLogado } from '@/api/tipos'
import { useAgora } from '@/lib/useAgora'
import { useSegundosAguardando } from '@/lib/useSegundosAguardando'
import { BannerReconexao } from './BannerReconexao'
import { BarraStatus } from './BarraStatus'
import { CabecalhoTriagem } from './CabecalhoTriagem'
import { CartoesCriticidade } from './CartoesCriticidade'
import { PainelAcordando, PainelErro, PainelVazio } from './PainelEstado'
import { resumirTriagem } from './resumo'
import { TabelaCarregando, TabelaIncidentes } from './TabelaIncidentes'
import { estadoDaConexao, useIncidentes } from './useIncidentes'

// Uma leitura normal leva menos de 1 s. Acima disto, o servidor do Render está acordando.
const ESPERA_NORMAL_S = 3

function mensagemFalhaLista(erro: unknown): string {
  if (!erro) return 'Sem conexão com o servidor. Confira a internet e tente de novo.'
  if (ehErroApi(erro)) {
    if (erro.codigo === 'sem_conexao') {
      return 'Sem conexão com o servidor. Confira a internet e tente de novo.'
    }
    if (erro.ehTransitorio) {
      return `O servidor não respondeu a tempo (erro ${erro.status}). Nenhum dado foi alterado.`
    }
    return `O servidor recusou a leitura (erro ${erro.status}). Nenhum dado foi alterado.`
  }
  return 'Erro inesperado. Nenhum dado foi alterado.'
}

interface Props {
  analista: AnalistaLogado
  aoSair: () => void
}

export function TelaTriagem({ analista, aoSair }: Props) {
  const consulta = useIncidentes()
  const agora = useAgora(30_000)
  const estado = estadoDaConexao(consulta)
  const itens = consulta.data?.itens
  const resumo = useMemo(() => (itens ? resumirTriagem(itens, agora) : null), [itens, agora])

  // Durante uma nova tentativa o TanStack apaga `error`: guarda o último para a mensagem
  // do painel não sumir no meio da tentativa.
  const [ultimoErro, setUltimoErro] = useState<unknown>(null)
  if (consulta.error && consulta.error !== ultimoErro) setUltimoErro(consulta.error)

  const segundosAguardando = useSegundosAguardando(estado === 'sincronizando')
  const acordando = segundosAguardando >= ESPERA_NORMAL_S

  const linhaEstado = itens
    ? `Mostrando ${itens.length} ${itens.length === 1 ? 'incidente' : 'incidentes'}`
    : estado === 'sem_conexao'
      ? 'Falha ao carregar a lista'
      : acordando
        ? 'Aguardando o servidor responder'
        : 'Carregando incidentes…'

  function conteudoDaTabela() {
    if (itens) {
      if (itens.length === 0) return <PainelVazio />
      return <TabelaIncidentes itens={itens} idAnalista={analista.id} agora={agora} />
    }
    if (estado === 'sem_conexao') {
      return (
        <PainelErro
          mensagem={mensagemFalhaLista(ultimoErro)}
          tentando={consulta.isFetching}
          aoTentar={() => void consulta.refetch()}
        />
      )
    }
    return acordando ? <PainelAcordando segundos={segundosAguardando} /> : <TabelaCarregando />
  }

  return (
    <div className="flex min-h-svh flex-col lg:h-svh">
      <CabecalhoTriagem
        analista={analista}
        estado={estado}
        atualizadoEm={consulta.dataUpdatedAt}
        aoSair={aoSair}
      />
      {estado === 'reconectando' && (
        <BannerReconexao
          tentativas={consulta.failureCount}
          atualizadoEm={consulta.dataUpdatedAt}
          aoTentarAgora={() => void consulta.refetch()}
        />
      )}

      <main className="flex min-h-0 flex-1 flex-col gap-3.5 px-4 pt-[18px] pb-4 sm:px-6">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h1 className="text-xl font-semibold tracking-[-0.01em]">Triagem</h1>
          {resumo && (
            <span className="text-[13px] text-texto-3">
              {resumo.ativos} incidentes ativos · {resumo.fechados} fechados
            </span>
          )}
        </div>

        <BarraStatus porStatus={resumo?.porStatus ?? null} />
        <CartoesCriticidade porCriticidade={resumo?.porCriticidade ?? null} />

        <div className="flex flex-wrap justify-between gap-x-4 gap-y-1 text-[13px]">
          <p aria-live="polite" className="text-texto-2">
            {linhaEstado}
          </p>
          <p className="text-texto-3">
            Ordem: criticidade alta primeiro e, dentro dela, o mais antigo · fechados ao fim
          </p>
        </div>

        <div
          className="min-h-[360px] flex-1 overflow-auto rounded-lg border bg-card"
        >
          {conteudoDaTabela()}
        </div>
      </main>
    </div>
  )
}
