import { Plus } from 'lucide-react'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { ehErroApi } from '@/api/erros'
import type { AnalistaLogado, Incidente } from '@/api/tipos'
import { Button } from '@/components/ui/button'
import { useAgora } from '@/lib/useAgora'
import { useSegundosAguardando } from '@/lib/useSegundosAguardando'
import { useValorAtrasado } from '@/lib/useValorAtrasado'
import { AvisoSucesso, PilhaAvisos } from './Avisos'
import { BannerReconexao } from './BannerReconexao'
import { BarraStatus } from './BarraStatus'
import { CabecalhoTriagem } from './CabecalhoTriagem'
import { CampoBusca, ID_CAMPO_BUSCA } from './CampoBusca'
import { CartoesCriticidade } from './CartoesCriticidade'
import { ConfirmarRemocao } from './ConfirmarRemocao'
import { FiltroCategorias } from './FiltroCategorias'
import {
  alternar,
  descreverFiltros,
  filtrarIncidentes,
  SEM_FILTROS,
  temFiltro,
} from './filtros'
import { PainelIncidente, type Concluido, type ModoPainel } from './PainelIncidente'
import { PainelAcordando, PainelErro, PainelVazio, PainelVazioFiltro } from './PainelEstado'
import { resumirTriagem } from './resumo'
import { TabelaCarregando, TabelaIncidentes } from './TabelaIncidentes'
import { definirFiltros, useFiltros } from './useFiltros'
import { useAcoesIncidente } from './useAcoesIncidente'
import { estadoDaConexao, useIncidentes } from './useIncidentes'

// Uma leitura normal leva menos de 1 s. Acima disto, o servidor do Render está acordando.
const ESPERA_NORMAL_S = 3
const ATRASO_ANUNCIO_MS = 700
const DURACAO_SUCESSO_MS = 8000
const ID_TITULO = 'titulo-triagem'

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

/** Troca de estado da tabela (carregando, lista, vazio, erro) com entrada suave. */
function Entrada({ children }: { children: ReactNode }) {
  return <div className="h-full animate-in duration-200 fade-in-0">{children}</div>
}

function textoMostrando(visiveis: Incidente[], total: number, filtrando: boolean): string {
  const palavra = total === 1 ? 'incidente' : 'incidentes'
  const texto = `Mostrando ${visiveis.length} de ${total} ${palavra}`
  if (!filtrando) return texto
  // Os cartões contam só ativos; a lista filtrada traz também os fechados, no fim. O aviso
  // explica a diferença entre "ALTA 26" e "Mostrando 31".
  const fechados = visiveis.filter((i) => i.status === 'fechado').length
  if (!fechados) return `${texto} (filtrado)`
  const rotulo = fechados === 1 ? 'fechado' : 'fechados'
  return `${texto} (filtrado) · ${fechados} ${rotulo} no fim da lista`
}

interface Props {
  analista: AnalistaLogado
  aoSair: () => void
}

export function TelaTriagem({ analista, aoSair }: Props) {
  const consulta = useIncidentes()
  const agora = useAgora(30_000)
  const estado = estadoDaConexao(consulta)
  const acoes = useAcoesIncidente(analista)
  const confirmados = consulta.data?.itens
  // Ações em andamento aparecem por cima da lista confirmada (contadores incluídos).
  const { sobrepor } = acoes
  const itens = useMemo(() => confirmados && sobrepor(confirmados), [confirmados, sobrepor])
  const resumo = useMemo(() => (itens ? resumirTriagem(itens, agora) : null), [itens, agora])

  const filtros = useFiltros()
  const filtrando = temFiltro(filtros)
  const resultado = useMemo(
    () => (itens ? filtrarIncidentes(itens, filtros) : null),
    [itens, filtros],
  )
  // Os cartões respeitam a categoria e a busca, mas não o próprio filtro de criticidade:
  // assim o analista vê quantos incidentes cada cartão traria ao ser escolhido.
  const porCriticidade = useMemo(
    () =>
      resultado ? resumirTriagem(resultado.semFiltroDeCriticidade, agora).porCriticidade : null,
    [resultado, agora],
  )
  function limparFiltros() {
    definirFiltros(() => SEM_FILTROS)
    // O botão clicado some junto com os filtros: o foco vai para a busca, e não para o topo
    // da página.
    document.getElementById(ID_CAMPO_BUSCA)?.focus()
  }

  const [painel, setPainel] = useState<ModoPainel | null>(null)
  const [removendo, setRemovendo] = useState<Incidente | null>(null)
  const [sucesso, setSucesso] = useState<(Concluido & { chave: number }) | null>(null)
  // O aviso de sucesso para de contar enquanto o mouse ou o foco estão nele.
  const [sucessoParado, setSucessoParado] = useState(false)

  useEffect(() => {
    if (!sucesso || sucessoParado) return
    const id = setTimeout(() => setSucesso(null), DURACAO_SUCESSO_MS)
    return () => clearTimeout(id)
  }, [sucesso, sucessoParado])

  function concluir(concluido: Concluido) {
    setPainel(null)
    setRemovendo(null)
    setSucessoParado(false)
    setSucesso({ ...concluido, chave: Date.now() })
  }

  // O botão que abriu o painel ou o diálogo pode ter saído da tela (linha removida ou lista
  // reordenada): o foco vem para o título, e não para o topo da página.
  const focarTitulo = () => document.getElementById(ID_TITULO)?.focus()

  function mostrarNaLista(id: number) {
    definirFiltros(() => ({ ...SEM_FILTROS, busca: `#${id}` }))
    setSucesso(null)
    document.getElementById(ID_CAMPO_BUSCA)?.focus()
  }

  // Durante uma nova tentativa o TanStack apaga `error`: guarda o último para a mensagem
  // do painel não sumir no meio da tentativa.
  const [ultimoErro, setUltimoErro] = useState<unknown>(null)
  if (consulta.error && consulta.error !== ultimoErro) setUltimoErro(consulta.error)

  const segundosAguardando = useSegundosAguardando(estado === 'sincronizando')
  const acordando = segundosAguardando >= ESPERA_NORMAL_S

  const linhaEstado = resultado
    ? textoMostrando(resultado.itens, itens?.length ?? 0, filtrando)
    : estado === 'sem_conexao'
      ? 'Falha ao carregar a lista'
      : acordando
        ? 'Aguardando o servidor responder'
        : 'Carregando incidentes…'

  const linhaAnunciada = useValorAtrasado(linhaEstado, ATRASO_ANUNCIO_MS)

  function conteudoDaTabela() {
    if (itens && resultado) {
      if (itens.length === 0) {
        return (
          <Entrada key="vazio">
            <PainelVazio />
          </Entrada>
        )
      }
      if (resultado.itens.length === 0) {
        return (
          <Entrada key="vazio-filtro">
            <PainelVazioFiltro
              descricao={descreverFiltros(filtros)}
              ativos={resumo?.ativos ?? 0}
              aoLimpar={limparFiltros}
            />
          </Entrada>
        )
      }
      return (
        <Entrada key="lista">
          <TabelaIncidentes
            itens={resultado.itens}
            idAnalista={analista.id}
            agora={agora}
            acoes={acoes}
            semConexao={estado !== 'ao_vivo'}
            aoEditar={(incidente) => setPainel({ tipo: 'editar', id: incidente.id })}
            aoRemover={setRemovendo}
          />
        </Entrada>
      )
    }
    if (estado === 'sem_conexao') {
      return (
        <Entrada key="erro">
          <PainelErro
            mensagem={mensagemFalhaLista(ultimoErro)}
            tentando={consulta.isFetching}
            aoTentar={() => void consulta.refetch()}
          />
        </Entrada>
      )
    }
    return acordando ? (
      <Entrada key="acordando">
        <PainelAcordando segundos={segundosAguardando} />
      </Entrada>
    ) : (
      <TabelaCarregando />
    )
  }

  return (
    <div className="flex min-h-svh flex-col lg:h-svh">
      <CabecalhoTriagem
        analista={analista}
        estado={estado}
        atualizadoEm={consulta.dataUpdatedAt}
        aoSair={aoSair}
        busca={
          <CampoBusca
            valor={filtros.busca}
            aoMudar={(busca) => definirFiltros((atuais) => ({ ...atuais, busca }))}
          />
        }
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
          <div className="flex items-center gap-4">
            {/* Focável por código: depois de remover, o foco vem para cá (a linha sumiu). */}
            <h1 id={ID_TITULO} tabIndex={-1} className="text-xl font-semibold tracking-[-0.01em] outline-none">
              Triagem
            </h1>
            <Button type="button" size="sm" onClick={() => setPainel({ tipo: 'criar' })}>
              <Plus aria-hidden />
              Novo incidente
            </Button>
          </div>
          {resumo && (
            <span className="text-[13px] text-texto-3">
              {resumo.ativos} incidentes ativos · {resumo.fechados} fechados
            </span>
          )}
        </div>

        <BarraStatus porStatus={resumo?.porStatus ?? null} />
        <CartoesCriticidade
          porCriticidade={porCriticidade}
          selecionadas={filtros.criticidades}
          aoAlternar={(c) =>
            definirFiltros((atuais) => ({
              ...atuais,
              criticidades: alternar(atuais.criticidades, c),
            }))
          }
        />
        <FiltroCategorias
          contagem={resultado?.ativosPorCategoria ?? null}
          selecionadas={filtros.categorias}
          aoAlternar={(c) =>
            definirFiltros((atuais) => ({ ...atuais, categorias: alternar(atuais.categorias, c) }))
          }
          aoLimpar={filtrando ? limparFiltros : undefined}
        />

        <div className="flex flex-wrap justify-between gap-x-4 gap-y-1 text-[13px]">
          <p className="text-texto-2">{linhaEstado}</p>
          {/* O leitor de tela ouve a contagem só quando a digitação para: sem isto, cada
              letra da busca geraria um anúncio. */}
          <p role="status" className="sr-only">
            {linhaAnunciada}
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

      {/* Região única para início, fim e conflito das ações. */}
      <p role="status" className="sr-only">
        {acoes.anuncio}
      </p>
      <p role="status" className="sr-only">
        {sucesso?.texto}
      </p>
      <PainelIncidente
        modo={painel}
        itens={itens}
        analista={analista}
        aoFechar={() => setPainel(null)}
        aoConcluir={concluir}
        aoFocarDepois={focarTitulo}
      />
      <ConfirmarRemocao
        incidente={removendo}
        itens={itens}
        analista={analista}
        aoFechar={() => setRemovendo(null)}
        aoConcluir={concluir}
        aoFocarDepois={focarTitulo}
      />
      <PilhaAvisos
        sucesso={
          sucesso && (
            <div
              key={sucesso.chave}
              onMouseEnter={() => setSucessoParado(true)}
              onMouseLeave={() => setSucessoParado(false)}
              onFocus={() => setSucessoParado(true)}
              onBlur={() => setSucessoParado(false)}
            >
              <AvisoSucesso
                texto={sucesso.texto}
                acao={
                  sucesso.criado
                    ? { rotulo: 'Mostrar na lista', aoClicar: () => mostrarNaLista(sucesso.id) }
                    : undefined
                }
                aoFechar={() => setSucesso(null)}
              />
            </div>
          )
        }
        // Aviso de uma versão que já mudou (outro analista agiu, ou a linha sumiu) não vale mais.
        avisos={acoes.avisos.filter(
          (aviso) =>
            aviso.removido ||
            itens?.find((item) => item.id === aviso.id)?.versao === aviso.versao,
        )}
        aoFechar={acoes.fecharAviso}
        aoTentar={(aviso) => {
          const atual = itens?.find((item) => item.id === aviso.id)
          if (atual) acoes.executar(atual, aviso.acao)
        }}
      />
    </div>
  )
}
